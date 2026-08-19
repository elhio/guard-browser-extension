import { ensureOffscreenDocument } from '@/lib/offscreen/ensureOffscreenDocument';
import {
  isClassifyImageRequest,
  CLASSIFY_IMAGE_OFFSCREEN_MESSAGE,
  CLASSIFY_RESULT_MESSAGE,
  type OffscreenClassifyImageRequest,
  type ClassifyImageResponse,
  type ClassifyImageResult,
  type ClassifyResultPush
} from '@/lib/messaging/classifyMessages';
import {
  isVerifyImageRequest,
  type VerifyImageData,
  type VerifyImageResponse
} from '@/lib/messaging/verifyMessages';
import { isOpenTabRequest } from '@/lib/messaging/openTab';
import { isAppHandoffRequest } from '@/lib/messaging/appHandoff';
import { respondAsync } from '@/lib/messaging/respondAsync';
import { isSubmitReactionRequest } from '@/lib/messaging/reactionMessages';
import { isCreateShareRequest, type CreateShareResponse } from '@/lib/messaging/shareMessages';
import { settings } from '@/lib/settings';
import {
  getUserId,
  getSpaceTaskMeta,
  runImageVerification,
  createReaction,
  createActivityShare,
  type SpaceTaskMeta
} from '@/lib/api';
import { fetchWithTimeout } from '@/lib/net/fetchWithTimeout';
import { t } from '@/lib/i18n';

/** How long to wait for the source image download during verification. */
const VERIFY_IMAGE_FETCH_TIMEOUT_MS = 10_000;

/** Only navigate to real web pages or our own extension pages — never javascript:/data:/file: URLs. */
function isSafeTabUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return (
      protocol === 'https:' ||
      protocol === 'http:' ||
      url.startsWith(browser.runtime.getURL('/'))
    );
  } catch {
    return false;
  }
}

/**
 * The token the website hands over after a login, relayed here by the content script.
 *
 * Kept as an inline shape rather than a shared message module: the matching `'TOKEN_RECEIVED'`
 * literals live in `content.ts` (sender) and `LoginForm.tsx` (the wizard's own listener).
 */
function isTokenReceived(message: unknown): message is { type: 'TOKEN_RECEIVED'; token: string } {
  const candidate = message as Record<string, unknown> | null;
  return (
    !!candidate &&
    candidate.type === 'TOKEN_RECEIVED' &&
    typeof candidate.token === 'string' &&
    candidate.token.length > 0
  );
}

/** Deduplicates concurrent calls within one background page load */
let openingSetup: Promise<void> | undefined;

/**
 * Opens the onboarding wizard, but only ever once — matching the other browsers, where closing the
 * wizard doesn't bring it back.
 */
function openSetupOnce(): Promise<void> {
  openingSetup ??= (async () => {
    const current = await settings.getValue();
    if (current.hasCompletedSetup || current.hasPromptedSetup) return;

    // Mark it prompted only once the tab actually exists. If `tabs.create` rejects, nothing was
    // opened, so the next background start should try again rather than silently swallow the user's
    // one shot at onboarding. A create that succeeds can't loop, so there's no tab-spam risk here.
    await browser.tabs.create({ url: browser.runtime.getURL('/setup.html') });
    // Re-read instead of reusing `current`: opening the tab above is slow, and another context may
    // have written settings meanwhile (e.g. the user finishing setup in the tab, or E2E seeding).
    // Merging over the latest value flips only `hasPromptedSetup` and avoids clobbering fields like
    // `hasCompletedSetup` back to their pre-open snapshot.
    const latest = await settings.getValue();
    await settings.setValue({ ...latest, hasPromptedSetup: true });
  })().catch((error) => {
    console.warn('[Guard] Could not open the setup wizard:', error);
  });

  return openingSetup;
}

/** Coalesces overlapping reports; see {@link runReport}. */
let reportInFlight: Promise<void> | undefined;
/** The throwaway tab the container app opened, waiting for a command to navigate it to. */
let handoffTabId: number | undefined;

/**
 * Reports to the container app and carries out whatever command comes back (Safari only).
 *
 * Serialized because the two callers collide: the handoff wakes this background page, so the report
 * fired at startup and the report fired by the handoff itself run at the same moment — and the
 * native handler drains the queued command destructively, so whichever round trip lands first gets
 * it. Left racing, the startup call would open a *second* tab while the handoff call, told there was
 * nothing to do, closed the one the app opened.
 *
 * The tab id rides along rather than being passed down into the native layer so that a report with
 * no tab (a settings write, a permission change) still picks up a command the handoff never reached
 * — that is the fallback for a user who hasn't granted site access, where no content script runs and
 * the command waits until `permissions.onAdded` wakes us.
 */
function runReport(tabId?: number): Promise<void> {
  if (tabId != null) handoffTabId = tabId;

  reportInFlight ??= (async () => {
    const { reportStateToApp, appCommandUrl } = await import('@/lib/native/reportState');
    const command = await reportStateToApp();

    const tab = handoffTabId;
    handoffTabId = undefined;

    if (command && tab != null) {
      const url = appCommandUrl(command);
      await browser.tabs.update(tab, { url }).catch(async () => {
        await browser.tabs.create({ url });
        await browser.tabs.remove(tab).catch(() => {});
      });
    } else if (command) {
      await browser.tabs.create({ url: appCommandUrl(command) });
    } else if (tab != null) {
      await browser.tabs.remove(tab).catch(() => {});
    }

    if (handoffTabId != null && handoffTabId !== tab) {
      await browser.tabs.remove(handoffTabId).catch(() => {});
      handoffTabId = undefined;
    }
  })().finally(() => {
    reportInFlight = undefined;
  });

  return reportInFlight;
}

/** Maps internal error codes from the verification flow to user-facing messages. */
function toVerifyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'unsupported-media') return t('verify_error_unsupported_media');
  if (message === 'timeout') return t('verify_error_timeout');
  return message;
}

export default defineBackground({
  persistent: { safari: false },
  main() {
    browser.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') void openSetupOnce();
    });

    if (import.meta.env.SAFARI) {
      void openSetupOnce();

      void runReport();
      settings.watch(() => void runReport());

      // Push a fresh report the instant the user grants or revokes website access in Safari, rather
      // than making the container app poll or wait for the extension's next run. The app reads the
      // App Group when it returns to the foreground, so by then it already sees the change — its
      // permissions step can flip to "Continue" without the user first having to load a page.
      // Registered at top level so Safari wakes this (non-persistent) background to deliver them.
      browser.permissions.onAdded.addListener(() => void runReport());
      browser.permissions.onRemoved.addListener(() => void runReport());
    }

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Defense-in-depth: only act on messages from our own extension contexts (content scripts,
      // popup, options, offscreen). Web pages can't reach here anyway (no externally_connectable),
      // but rejecting any foreign sender keeps that guarantee explicit.
      if (sender.id !== browser.runtime.id) return undefined;

      // PATH 0: the container app is handing off — collect its instruction and turn the throwaway
      // page it opened into the page the user actually asked for.
      if (import.meta.env.SAFARI && isAppHandoffRequest(message)) {
        // Returning the promise keeps the non-persistent page alive until the navigation has
        // happened; otherwise Safari may unload us mid-handoff and the tap appears to do nothing.
        return runReport(sender.tab?.id).then(() => undefined);
      }

      // PATH 1: classification
      if (isClassifyImageRequest(message)) {
        const errorResults = (reason: unknown): ClassifyImageResult[] =>
          message.candidates.map((c) => ({ status: 'error', src: c.src, error: String(reason) }));

        if (import.meta.env.MANIFEST_VERSION === 2) {
          // MV2 targets (Firefox + Safari) have no offscreen API. The background page (which has a
          // DOM) hosts the offscreen page in an iframe and drives it over window.postMessage — and it
          // can't return a runtime response to a content-script sender, so the result is PUSHED back
          // to the sender's frame via tabs.sendMessage. Keeping the work in that ESM iframe also
          // avoids pulling transformers.js into the IIFE-bundled background.
          const tabId = sender.tab?.id;
          const frameId = sender.frameId;
          const work = (async (): Promise<ClassifyImageResult[]> => {
            try {
              const { classifyViaOffscreenIframe } = await import('@/lib/offscreen/offscreenClient');
              return await classifyViaOffscreenIframe(
                message.candidates,
                message.tasks,
                message.useDetectorLocalModel
              );
            } catch (error) {
              return errorResults(error);
            }
          })();

          void work.then((results) => {
            if (tabId == null) return;
            const push: ClassifyResultPush = {
              type: CLASSIFY_RESULT_MESSAGE,
              requestId: message.requestId,
              results
            };
            void browser.tabs
              .sendMessage(tabId, push, frameId != null ? { frameId } : undefined)
              .catch(() => {});
          });

          if (import.meta.env.SAFARI) {
            // Safari's background page is non-persistent (see `persistent` above)
            return work.then(() => undefined);
          }
          return undefined;
        }

        // Chrome (MV3): the DOM-less service worker offloads the work to an offscreen document and
        // returns the result as the message response (which keeps the worker alive until it settles).
        const work = (async (): Promise<ClassifyImageResponse> => {
          try {
            await ensureOffscreenDocument();

            const request: OffscreenClassifyImageRequest = {
              type: CLASSIFY_IMAGE_OFFSCREEN_MESSAGE,
              candidates: message.candidates,
              tasks: message.tasks,
              useDetectorLocalModel: message.useDetectorLocalModel
            };

            return (await browser.runtime.sendMessage(request)) as ClassifyImageResponse;
          } catch (error) {
            return { results: errorResults(error) };
          }
        })();
        return respondAsync(work, sendResponse);
      }

      // PATH 2: external verification — full activity lifecycle
      if (isVerifyImageRequest(message)) {
        const work = (async (): Promise<VerifyImageResponse> => {
          try {
            const { token, verificatorSpace } = await settings.getValue();
            if (!token) throw new Error(t('verify_error_not_signed_in'));
            if (!verificatorSpace) throw new Error(t('verify_error_no_space'));

            const userId = await getUserId(token);

            // Download the image bytes to upload for verification.
            const imageResponse = await fetchWithTimeout(message.src, VERIFY_IMAGE_FETCH_TIMEOUT_MS);
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image: HTTP ${imageResponse.status}`);
            }
            const blob = await imageResponse.blob();

            const result = await runImageVerification(token, {
              spaceId: verificatorSpace,
              userId,
              blob
            });

            // Result items only carry a task_id + outcome label, so resolve each task's
            // detection category and feedback reactions via the space's (cached) task list.
            const taskMeta: Record<string, SpaceTaskMeta> =
              await getSpaceTaskMeta(token, verificatorSpace).catch(() => ({}));

            const data: VerifyImageData = {
              activityId: result.activityId,
              results: result.results.map((item) => ({
                taskId: item.task_id,
                category: taskMeta[item.task_id]?.category ?? null,
                reactions: taskMeta[item.task_id]?.reactions ?? {},
                label: item.label,
                score: item.score,
                description: item.description ?? undefined
              }))
            };

            return { success: true, data };
          } catch (error) {
            return { success: false, error: toVerifyErrorMessage(error) };
          }
        })();
        return respondAsync(work, sendResponse);
      }

      // PATH 3: open a URL in a new tab (menu "Sign in" / "Choose a space")
      if (isOpenTabRequest(message)) {
        // Only ever open web pages or our own extension pages — never javascript:/data:/file: etc.
        if (isSafeTabUrl(message.url)) {
          void browser.tabs.create({ url: message.url });
        } else {
          console.warn('[Guard] Blocked OPEN_TAB for unsafe URL:', message.url);
        }
        return undefined;
      }

      // PATH 3.5: the website handed over a token after a login. Stored here rather than in an
      // extension page because the sign-in can start from the in-page badge menu — PATH 3 above
      // opens the tab and then no extension page is open to hear the result, so it used to be
      // dropped and the user stayed signed out with the login tab left behind.
      if (isTokenReceived(message)) {
        const tabId = sender.tab?.id;
        const work = (async () => {
          const current = await settings.getValue();
          // Merged over the current value: this must not disturb `hasCompletedSetup`, `tasks` or
          // any other preference.
          await settings.setValue({ ...current, token: message.token, isLoggedIn: true });
          // The website deliberately waits ~500ms after posting for us to do this.
          if (tabId != null) await browser.tabs.remove(tabId).catch(() => {});
        })();
        // Returning the promise keeps the non-persistent MV2 background (Firefox/Safari) alive
        // until the write lands, rather than being unloaded mid-store.
        return work.then(() => undefined);
      }

      // PATH 4: submit a feedback reaction (the response is just an acknowledgement)
      if (isSubmitReactionRequest(message)) {
        const work = (async (): Promise<undefined> => {
          try {
            const { token } = await settings.getValue();
            if (token) {
              await createReaction(token, {
                activityId: message.activityId,
                taskId: message.taskId,
                isPositive: message.isPositive,
                keyValue: message.keyValue,
                description: message.description
              });
            }
          } catch (error) {
            console.warn('[Guard] Failed to submit reaction:', error);
          }
          return undefined;
        })();
        return respondAsync(work, sendResponse);
      }

      // PATH 5: create a shareable result link
      if (isCreateShareRequest(message)) {
        const work = (async (): Promise<CreateShareResponse> => {
          try {
            const { token } = await settings.getValue();
            if (!token) throw new Error(t('verify_error_not_signed_in'));
            const share = await createActivityShare(token, {
              activityId: message.activityId,
              taskId: message.taskId,
              expiresIn: message.expiresIn
            });
            return { success: true, shareUrl: share.share_url };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        })();
        return respondAsync(work, sendResponse);
      }

      return undefined;
    });
  },
});