import type { C2paReadResult } from '@/lib/c2pa';
import type { ClassifyImageResponse } from '@/lib/messaging/modelMessages';
import { attachBadge } from './attachBadge';

/**
 * Batch-processes scanned images and attaches the interactive unified badge to them
 *
 * Note: The `results` array comes back from the background script. Because DOM elements cannot be
 * serialized and passed across extension runtime messaging boundaries, the `candidate` in the result is
 * just a data object. We use `elementsBySrc` to map the resolved URLs back to the live `<img>` DOM nodes.
 *
 * @param results - The array of parsed C2PA/metadata results from the background worker
 * @param elementsBySrc - A map linking absolute image URLs back to their live DOM nodes
 * @param buildAnalyze - A factory function that takes an image URL and returns the specific API callback for that image
 */
export function showBadges(
  results: readonly C2paReadResult[],
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>,
  buildAnalyze: (src: string) => () => Promise<ClassifyImageResponse>
): void {
  for (const result of results) {
    if (result.status !== 'success') continue;

    const element = elementsBySrc.get(result.candidate.src);
    if (element) {
      attachBadge(
        element,
        result.aiDetection,
        buildAnalyze(result.candidate.src)
      );
    }
  }
}