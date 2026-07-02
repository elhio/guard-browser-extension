import type { C2paReadResult } from '@/lib/c2pa';
import { attachAiBadge } from './attachAiBadge';

/**
 * Attaches an "AI-generated" badge over every scanned image whose C2PA
 * manifest was flagged as likely AI-generated.
 *
 * `results` come back from the background script with their `candidate`
 * stripped of the original DOM element (it can't cross runtime messaging),
 * so callers pass `elementsBySrc` — a lookup built from the original,
 * not-yet-serialized candidates — to find the actual <img> to overlay.
 */
export function showAiBadges(
  results: readonly C2paReadResult[],
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>
): void {
  for (const result of results) {
    if (result.status !== 'success' || !result.aiDetection.isLikelyAiGenerated) continue;

    const element = elementsBySrc.get(result.candidate.src);
    if (element) {
      attachAiBadge(element, result.aiDetection);
    }
  }
}