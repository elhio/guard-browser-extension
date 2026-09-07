import type { RingStatus } from './store';

/**
 * The lightweight per-image status ring. Clicking it opens the shared menu for its `src`.
 * (The rich menu UI lives in the React shadow-root overlay, not here.)
 */
export interface BadgeRing {
  host: HTMLElement;
  setStatus: (status: RingStatus) => void;
}

/**
 * Encapsulated styles for the ring.
 *
 * The host is a fixed 24x24 box pinned at the layer's origin; `badgeLayer` moves it with a
 * `transform`, so no offsets are set here. `all: initial` isolates the ring from the Tailwind reset
 * that shares its shadow tree, and forces an explicit `display` because `all: initial` computes to
 * `inline`. The ring must opt back into pointer events: the layer around it is click-through.
 */
const RING_STYLES = `
  :host {
    all: initial;
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: 24px;
    height: 24px;
    pointer-events: auto;
  }
  .ring {
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 50%;
    box-sizing: border-box;
    cursor: pointer;
    transition: transform 0.15s ease;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  }
  .ring:hover { transform: scale(1.1); }

  .ring.idle { border: 3px solid rgba(200, 200, 200, 0.55); background: rgba(0, 0, 0, 0.2); }
  .ring.alert { border: 3px solid rgba(239, 68, 68, 0.9); background: rgba(239, 68, 68, 0.3); }
  .ring.error { border: 3px solid rgba(156, 163, 175, 0.85); background: rgba(107, 114, 128, 0.5); cursor: not-allowed; }
  .ring.processing {
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #14b8a6; /* teal-500 */
    background: rgba(0, 0, 0, 0.4);
    animation: guard-spin 1s linear infinite;
    cursor: wait;
  }
  @keyframes guard-spin { 100% { transform: rotate(360deg); } }
`;

/**
 * Builds a status ring for one image.
 *
 * @param onActivate - Called when the ring is clicked. The ring does not open the menu itself: only
 *   `badgeLayer` knows the image's clipped anchor rect, so it owns that call.
 */
export function createBadgeRing(onActivate: () => void): BadgeRing {
  const host = document.createElement('div');
  // The ring's own shadow is closed, so this attribute on the host is the only handle tests have.
  host.setAttribute('data-guard-ring', '');
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = RING_STYLES;

  const ring = document.createElement('button');
  ring.type = 'button';
  ring.className = 'ring processing';
  ring.setAttribute('aria-label', 'Guard');

  ring.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  });

  shadow.append(style, ring);

  return {
    host,
    setStatus: (status) => {
      ring.className = `ring ${status}`;
    },
  };
}
