import type { AiDetectionResult } from '@/lib/c2pa';

const BADGE_STYLES = `
  :host {
    all: initial;
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 2147483647;
    pointer-events: none;
  }
  .badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(178, 36, 36, 0.92);
    color: #fff;
    font: 600 12px/1.4 system-ui, sans-serif;
    white-space: nowrap;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  }
`;

/** Builds the evidence tooltip text shown on hover, listing every matched signal. */
function buildTooltip(aiDetection: AiDetectionResult): string {
  return aiDetection.matches.map((match) => `${match.label} (${match.confidence}%): ${match.evidence}`).join('\n');
}

/**
 * Creates a small "AI-generated" badge as a Shadow DOM host element, isolated
 * from the host page's CSS so it can't be broken or overridden by page styles.
 * The host carries `position: absolute` and is meant to be appended into a
 * `position: relative` wrapper around the target image (see imageWrapper.ts),
 * so it stays aligned with the image natively, with no JS repositioning.
 */
export function createAiBadgeElement(aiDetection: AiDetectionResult): HTMLElement {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = BADGE_STYLES;

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = `⚠ KI-generiert (${aiDetection.confidence}%)`;
  badge.title = buildTooltip(aiDetection);

  shadow.append(style, badge);
  return host;
}