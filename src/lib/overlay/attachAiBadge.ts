import type { AiDetectionResult } from '@/lib/c2pa';
import { createAiBadgeElement } from './badgeElement';
import { ensureBadgeWrapper } from './imageWrapper';
import { trackBadge } from './badgeLifecycle';

/**
 * Overlays a small "AI-generated" badge right next to `target` in the DOM,
 * inside a thin positioning wrapper, so it scrolls/resizes natively with the
 * page instead of needing per-frame repositioning.
 */
export function attachAiBadge(target: HTMLImageElement, aiDetection: AiDetectionResult): void {
  const wrapper = ensureBadgeWrapper(target);
  const badgeHost = createAiBadgeElement(aiDetection);
  wrapper.append(badgeHost);
  trackBadge(badgeHost, target, wrapper);
}