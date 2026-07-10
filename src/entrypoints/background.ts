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

/** Maps internal error codes from the verification flow to user-facing messages. */
function toVerifyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'unsupported-media') return t('verify_error_unsupported_media');
  if (message === 'timeout') return t('verify_error_timeout');
  return message;
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      const { hasCompletedSetup } = await settings.getValue();

      if (!hasCompletedSetup) {
        browser.tabs.create({
          url: browser.runtime.getURL('/setup.html')
        });
      }
    }
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Defense-in-depth: only act on messages from our own extension contexts (content scripts,
    // popup, options, offscreen). Web pages can't reach here anyway (no externally_connectable),
    // but rejecting any foreign sender keeps that guarantee explicit.
    if (sender.id !== browser.runtime.id) return undefined;

    // PATH 1: classification
    if (isClassifyImageRequest(message)) {
      const errorResults = (reason: unknown): ClassifyImageResult[] =>
        message.candidates.map((c) => ({ status: 'error', src: c.src, error: String(reason) }));

      if (import.meta.env.FIREFOX) {
        // Firefox has no offscreen API. The background page (which has a DOM) hosts the offscreen
        // page in an iframe and drives it over window.postMessage — and it can't return a runtime
        // response to a content-script sender, so the result is PUSHED back to the sender's frame
        // via tabs.sendMessage. Keeping the work in that ESM iframe also avoids pulling
        // transformers.js into the IIFE-bundled background.
        const tabId = sender.tab?.id;
        const frameId = sender.frameId;
        void (async () => {
          let results: ClassifyImageResult[];
          try {
            const { classifyViaOffscreenIframe } = await import('@/lib/offscreen/offscreenClient');
            results = await classifyViaOffscreenIframe(
              message.candidates,
              message.tasks,
              message.useDetectorLocalModel
            );
          } catch (error) {
            results = errorResults(error);
          }
          if (tabId != null) {
            const push: ClassifyResultPush = {
              type: CLASSIFY_RESULT_MESSAGE,
              requestId: message.requestId,
              results
            };
            void browser.tabs
              .sendMessage(tabId, push, frameId != null ? { frameId } : undefined)
              .catch(() => {});
          }
        })();
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
});