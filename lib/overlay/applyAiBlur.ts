import type { C2paReadResult } from '@/lib/c2pa';
import { markAiImageForBlur } from './aiImageBlur';

/**
 * Flags every scanned image whose C2PA manifest was flagged as likely
 * AI-generated for blurring, mirroring `showAiBadges`'s lookup of the
 * original DOM element by src.
 */
export function applyAiBlur(
  results: readonly C2paReadResult[],
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>
): void {
  for (const result of results) {
    if (result.status !== 'success' || !result.aiDetection.isLikelyAiGenerated) continue;

    const element = elementsBySrc.get(result.candidate.src);
    if (element) {
      markAiImageForBlur(element);
    }
  }
}
