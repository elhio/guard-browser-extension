const FALLBACK_STYLES = `
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
  }
  .badge.button {
    cursor: pointer;
    background: rgba(17, 19, 28, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.25);
  }
  .badge.button:hover {
    background: rgba(17, 19, 28, 0.95);
  }
  .badge.authentic {
    cursor: pointer;
    background: rgba(22, 122, 80, 0.92);
  }
  .badge.authentic:hover {
    background: rgba(22, 122, 80, 1);
  }
  .badge.pending {
    background: rgba(17, 19, 28, 0.82);
  }
  .badge.ai {
    background: rgba(178, 36, 36, 0.92);
  }
  .badge.clean {
    background: rgba(22, 122, 80, 0.92);
  }
  .badge.error {
    background: rgba(120, 120, 120, 0.92);
  }
`;

type Variant = 'button' | 'authentic' | 'pending' | 'ai' | 'clean' | 'error';

export interface ModelFallbackBadge {
  /** The Shadow DOM host element to insert into an image wrapper. */
  host: HTMLElement;
  /** Neutral "analyze with AI" button — used when metadata is inconclusive. */
  showAnalyzeButton: (onClick: () => void) => void;
  /**
   * Green "metadata says this is a real photo" button. Still clickable so the
   * user can run the local model anyway; `tooltip` lists the evidence on hover.
   */
  showAuthenticButton: (onClick: () => void, tooltip: string) => void;
  showPending: () => void;
  showResult: (aiScore: number) => void;
  showError: () => void;
}

/**
 * Creates a single re-renderable badge (Shadow DOM, isolated from page CSS) used
 * for the local-model fallback: it starts as a clickable "analyze" button and is
 * re-rendered in place to a pending/result/error state — so it is only tracked
 * and positioned once.
 */
export function createModelFallbackBadge(): ModelFallbackBadge {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = FALLBACK_STYLES;

  const badge = document.createElement('span');
  badge.className = 'badge';

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
    showAnalyzeButton: (onClick) => render('button', '🔍 Mit KI prüfen', onClick),
    showAuthenticButton: (onClick, tooltip) =>
      render('authentic', '✓ Metadaten: echtes Bild · KI-Check', onClick, tooltip),
    showPending: () => render('pending', '⏳ Analysiere …'),
    showResult: (aiScore) => {
      const percent = Math.round(aiScore * 100);
      if (aiScore >= 0.5) {
        render('ai', `🤖 KI-Verdacht (${percent}%)`);
      } else {
        render('clean', `✓ Wahrscheinlich echt (${percent}% KI)`);
      }
    },
    showError: () => render('error', '⚠ Analyse fehlgeschlagen')
  };
}