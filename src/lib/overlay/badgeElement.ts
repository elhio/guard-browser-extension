import type { ImageAnalysisResult } from '@/lib/detection/types';
import type { VerifyImageData } from '@/lib/messaging/verifyMessages';

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
    top: 8px;
    right: 8px; /* <-- CHANGED: Moves the badge to the top right */
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  .wrapper { position: relative; display: inline-flex; }

  /* Ring Base */
  .ring {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    box-sizing: border-box;
    cursor: pointer;
    transition: all 0.2s ease;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  }

  /* Ring States */
  .ring.idle { border: 3px solid rgba(200, 200, 200, 0.4); background: rgba(0, 0, 0, 0.2); }
  .ring.alert { border: 3px solid rgba(239, 68, 68, 0.9); background: rgba(239, 68, 68, 0.3); }
  
  .ring.processing {
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #3b82f6; /* Blue spinner */
    background: rgba(0, 0, 0, 0.4);
    animation: spin 1s linear infinite;
    cursor: wait;
  }

  .ring.error {
    border: 3px solid rgba(156, 163, 175, 0.8); /* Gray */
    background: rgba(107, 114, 128, 0.5);
    cursor: not-allowed;
  }

  @keyframes spin { 100% { transform: rotate(360deg); } }
  .ring:hover { transform: scale(1.05); }

  /* Tooltip */
  .tooltip {
    position: absolute; 
    top: 100%; 
    right: 0; /* <-- CHANGED: Anchors tooltip to the right so it doesn't overflow off-screen */
    margin-top: 8px;
    background: rgba(17, 19, 28, 0.95); border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px; padding: 12px; width: 220px; color: #fff; font-size: 13px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6); display: none; flex-direction: column; gap: 12px; cursor: default;
  }
  .wrapper:hover .tooltip { display: flex; }

  /* Inner UI Elements */
  .results-grid { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; }
  .category-label { color: #cbd5e1; }
  .category-score { font-weight: 600; }
  .score-high { color: #ef4444; }
  .score-low { color: #10b981; }
  .divider { height: 1px; background: rgba(255, 255, 255, 0.15); margin: 4px 0; }
  .message-text { color: #cbd5e1; font-size: 13px; text-align: center; }

  /* Buttons */
  .btn {
    color: white; border: none; border-radius: 6px; padding: 8px;
    cursor: pointer; font-weight: 600; font-size: 12px; width: 100%;
    transition: background 0.15s;
  }
  .verify-btn { background: #2563eb; }
  .verify-btn:hover:not(:disabled) { background: #1d4ed8; }
  .verify-btn:disabled { background: #475569; cursor: not-allowed; color: #cbd5e1; }
  .verify-btn.error { background: #dc2626; color: white; }
  
  .reveal-btn { background: #4b5563; margin-top: 4px; }
  .reveal-btn:hover { background: #374151; }
`;

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
  setProcessing: (msg: string) => void;
  setResult: (config: { result: ImageAnalysisResult; isAlert: boolean; onVerify?: () => void; onReveal?: () => void }) => void;
  setVerificationPending: () => void;
  setVerificationResult: (data: VerifyImageData) => void;
  setError: (msg: string) => void;
}

/**
 * Helper to build rows for the tooltip results grid
 */
function buildScoreRow(label: string, score: number, isScale0To1 = false): string {
  const percent = isScale0To1 ? Math.round(score * 100) : Math.round(score);
  const colorClass = percent > 50 ? 'score-high' : 'score-low';

  return `
    <div class="category-label">${label}</div>
    <div class="category-score ${colorClass}">${percent}%</div>
  `;
}

/**
 * Compiles a multiline tooltip string containing the detailed evidence from the metadata scan
 *
 * @param aiDetection - The summarized results containing matched signals
 * @returns A formatted string listing each triggered rule, its confidence, and specific evidence
 */
export function createBadgeElement(): UnifiedBadge {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = BADGE_STYLES;

  const wrapper = document.createElement('div');
  wrapper.className = 'wrapper';

  const ring = document.createElement('div');
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';

  const detailsContainer = document.createElement('div');

  const verifyBtn = document.createElement('button');
  verifyBtn.className = 'btn verify-btn';
  verifyBtn.textContent = 'Verify with Advanced Model';

  const revealBtn = document.createElement('button');
  revealBtn.className = 'btn reveal-btn';
  revealBtn.textContent = '👁 Unblur / Reveal Image';

  tooltip.append(detailsContainer, verifyBtn, revealBtn);
  wrapper.append(ring, tooltip);
  shadow.append(style, wrapper);

  let currentVerifyCallback: (() => void) | undefined;
  let currentRevealCallback: (() => void) | undefined;

  verifyBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (currentVerifyCallback) currentVerifyCallback();
  });

  revealBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (currentRevealCallback) {
      currentRevealCallback();
      revealBtn.style.display = 'none'; // Hide button after it's clicked
    }
  });

  return {
    host,
    setProcessing: (msg) => {
      ring.className = 'ring processing';
      verifyBtn.style.display = 'none';
      revealBtn.style.display = 'none';
      detailsContainer.innerHTML = `<div class="message-text">⏳ ${msg}</div>`;
    },
    setResult: ({ result, isAlert, onVerify, onReveal }) => {
      ring.className = isAlert ? 'ring alert' : 'ring idle';
      currentVerifyCallback = onVerify;
      currentRevealCallback = onReveal;

      verifyBtn.style.display = onVerify ? 'block' : 'none';
      revealBtn.style.display = (isAlert && onReveal) ? 'block' : 'none'; // Only show reveal if there's an active alert action

      detailsContainer.innerHTML = `
        ${buildScoreRow('AI Generated', result.categories.aiGenerated?.confidence ?? 0)}
        ${buildScoreRow('Violent', result.categories.violent?.confidence ?? 0)}
        ${buildScoreRow('Explicit', result.categories.explicit?.confidence ?? 0)}
      `;
    },
    setVerificationPending: () => {
      verifyBtn.disabled = true;
      verifyBtn.textContent = '⏳ Analyzing...';
      verifyBtn.classList.remove('error');
    },
    setVerificationResult: (data) => {
      verifyBtn.style.display = 'none';
      detailsContainer.innerHTML += `
        <div class="divider" style="grid-column: 1 / -1;"></div>
        <div class="category-label" style="grid-column: 1 / -1; font-weight: bold; color: #fff;">External API Results:</div>
        ${buildScoreRow('AI Generated', data.aiGenerated ?? 0, true)}
        ${buildScoreRow('Violent', data.violent ?? 0, true)}
        ${buildScoreRow('Explicit', data.explicit ?? 0, true)}
      `;
      const isAdvancedAlert = (data.aiGenerated ?? 0) > 0.50 || (data.violent ?? 0) > 0.50 || (data.explicit ?? 0) > 0.50;
      ring.className = isAdvancedAlert ? 'ring alert' : 'ring idle';
    },
    setError: (msg) => {
      ring.className = 'ring error';
      verifyBtn.style.display = 'none';
      detailsContainer.innerHTML = `<div class="message-text">⚠ ${msg}</div>`;
    }
  };
}