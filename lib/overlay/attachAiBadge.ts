import type { AiDetectionResult } from '../c2pa/aiDetection/types';
import { createAiBadgeElement } from './badgeElement';
import { positionBadgeOverElement } from './positionBadge';
import { trackBadge } from './badgeTicker';

/** Overlays a small "AI-generated" badge on top of `target`, kept in sync as the page scrolls/resizes. */
export function attachAiBadge(target: Element, aiDetection: AiDetectionResult): void {
  const badgeHost = createAiBadgeElement(aiDetection);
  document.body.append(badgeHost);
  positionBadgeOverElement(badgeHost, target);
  trackBadge(badgeHost, target);
}
