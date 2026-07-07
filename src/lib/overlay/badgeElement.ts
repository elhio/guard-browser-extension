import type { CategoryDetectionResult } from '@/lib/c2pa';

/**
 * Isolated CSS styles for the badge component.
 *
 * Note: Using `:host` styles the Shadow DOM root, while the rest of the classes are completely encapsulated. This
 * ensures the extension's UI cannot be broken, hidden, or overridden by the host page's native stylesheets.
 */
const BADGE_STYLES = `
  :host {
    all: initial;
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 2147483647;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 999px;
    font: 600 12px/1.4 system-ui, sans-serif;
    white-space: nowrap;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    color: #fff;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.25);
    transition: background 0.15s ease;
  }
  .badge.button {
    background: rgba(17, 19, 28, 0.82);
  }
  .badge.button:hover {
    background: rgba(17, 19, 28, 0.95);
  }
  .badge.authentic {
    background: rgba(22, 122, 80, 0.92);
  }
  .badge.authentic:hover {
    background: rgba(22, 122, 80, 1);
  }
  .badge.ai {
    background: rgba(178, 36, 36, 0.92);
  }
  .badge.ai:hover {
    background: rgba(178, 36, 36, 1);
  }
  .badge.pending {
    background: rgba(17, 19, 28, 0.82);
    cursor: wait;
  }
  .badge.error {
    background: rgba(120, 120, 120, 0.92);
    cursor: not-allowed;
  }
`;

/** Represents the specific visual and semantic states the badge can inhabit. */
type Variant = 'button' | 'authentic' | 'pending' | 'ai' | 'error';

/**
 * Represents the interface for interacting with the encapsulated badge DOM element
 *
 * @property host - The DOM node that should be inserted into the image wrapper on the host page
 * @property showInitialState - Sets the initial visual state based on the local metadata scan
 * @property showPending - Transitions the badge to a loading state
 * @property showResult - Sets the final verdict state based on the external model's response
 * @property showError - Transitions the badge to an error state if the external API call fails, times out, or returns invalid data
 */
export interface UnifiedBadge {
  host: HTMLElement;
  showInitialState: (detection: CategoryDetectionResult, onClick: () => void) => void;
  showPending: () => void;
  showResult: (aiScore: number) => void;
  showError: () => void;
}

/**
 * Compiles a multiline tooltip string containing the detailed evidence from the metadata scan
 *
 * @param aiDetection - The summarized results containing matched signals
 * @returns A formatted string listing each triggered rule, its confidence, and specific evidence
 */
function buildTooltip(aiDetection: CategoryDetectionResult): string {
  if (!aiDetection.matches.length) return 'Click to verify with advanced model';
  const evidence = aiDetection.matches.map((m) => `${m.label} (${m.confidence}%): ${m.evidence}`).join('\n');
  return `${evidence}\n\n(Click to verify with advanced model)`;
}

/**
 * Creates a single interactive unified badge instance
 *
 * Note: The badge utilizes a closed shadow DOM to strictly isolate its CSS
 * from the host page. It acts as a lightweight state machine, starting with an initial
 * likelihood based on metadata, and safely transitioning in-place to a pending or result
 * state when the user triggers an external verification.
 *
 * @returns A `UnifiedBadge` object containing the mountable host element and state transition methods
 */
export function createBadgeElement(): UnifiedBadge {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = BADGE_STYLES;

  const badge = document.createElement('span');
  shadow.append(style, badge);

  function render(variant: Variant, text: string, onClick?: () => void, tooltip?: string): void {
    badge.className = `badge ${variant}`;
    badge.textContent = text;
    badge.title = tooltip ?? '';
    badge.style.pointerEvents = onClick ? 'auto' : 'none';
    badge.onclick = onClick ?? null;
  }

  return {
    host,
    showInitialState: (detection, onClick) => {
      const tooltip = buildTooltip(detection);
      if (detection.detected) {
        render('ai', `⚠ AI-Generated (${detection.confidence}%)`, onClick, tooltip);
      } else if (detection.matches.length > 0) {
        render('authentic', `✓ Metadata (${detection.confidence}% AI)`, onClick, tooltip);
      } else {
        render('button', '🔍 Verify', onClick, tooltip);
      }
    },
    showPending: () => render('pending', '⏳ Analyze …'),
    showResult: (aiScore) => {
      const percent = Math.round(aiScore * 100);
      if (aiScore >= 0.5) {
        render('ai', `🤖 AI-Generated (${percent}%)`);
      } else {
        render('authentic', `✓ Verification (${percent}% AI)`);
      }
    },
    showError: () => render('error', '⚠ Verification failed')
  };
}