import { ensureOffscreenDocument } from '@/lib/offscreen/ensureOffscreenDocument';
import {
  isClassifyImageRequest,
  CLASSIFY_IMAGE_OFFSCREEN_MESSAGE,
  type OffscreenClassifyImageRequest,
  type ClassifyImageResponse
} from '@/lib/messaging/classifyMessages';
import {
  isVerifyImageRequest,
  type VerifyImageData,
  type VerifyImageResponse
} from '@/lib/messaging/verifyMessages';
import { isOpenTabRequest } from '@/lib/messaging/openTab';
import { settings } from '@/lib/settings';
import { getUserId, getSpaceTaskCategoryMap, runImageVerification } from '@/lib/api';
import type { DetectionCategory } from '@/lib/detection';
import { fetchWithTimeout } from '@/lib/net/fetchWithTimeout';
import { t } from '@/lib/i18n';

/** How long to wait for the source image download during verification. */
const VERIFY_IMAGE_FETCH_TIMEOUT_MS = 10_000;

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

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // PATH 1: classification
    if (isClassifyImageRequest(message)) {
      (async () => {
        try {
          await ensureOffscreenDocument();

          const request: OffscreenClassifyImageRequest = {
            type: CLASSIFY_IMAGE_OFFSCREEN_MESSAGE,
            candidates: message.candidates,
            tasks: message.tasks,
            useDetectorLocalModel: message.useDetectorLocalModel
          };

          const response = (await browser.runtime.sendMessage(request)) as ClassifyImageResponse;
          sendResponse(response);
        } catch (error) {
          // If the offscreen document crashes entirely, safely fail all candidates
          // so the content script doesn't hang waiting for a response
          const fallbackResponse: ClassifyImageResponse = {
            results: message.candidates.map((c) => ({
              status: 'error',
              src: c.src,
              error: String(error)
            }))
          };
          sendResponse(fallbackResponse);
        }
      })();
      return true;
    }

    // PATH 2: external verification — full activity lifecycle
    if (isVerifyImageRequest(message)) {
      (async () => {
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

          // Result items only carry a task_id + outcome label, so resolve which detection
          // category each task belongs to via the space's (cached) task list.
          const taskCategories: Record<string, DetectionCategory> =
            await getSpaceTaskCategoryMap(token, verificatorSpace).catch(() => ({}));

          const data: VerifyImageData = {
            results: result.results.map((item) => ({
              taskId: item.task_id,
              category: taskCategories[item.task_id] ?? null,
              label: item.label,
              score: item.score,
              description: item.description ?? undefined
            }))
          };

          sendResponse({ success: true, data } satisfies VerifyImageResponse);
        } catch (error) {
          sendResponse({ success: false, error: toVerifyErrorMessage(error) } satisfies VerifyImageResponse);
        }
      })();
      return true;
    }

    // PATH 3: open a URL in a new tab (menu "Sign in" / "Choose a space")
    if (isOpenTabRequest(message)) {
      void browser.tabs.create({ url: message.url });
      return undefined;
    }

    return undefined;
  });
});