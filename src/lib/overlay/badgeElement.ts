import { openMenu, type RingStatus } from './store';

/**
 * The lightweight per-image status ring. Clicking it opens the shared menu for its `src`.
 * (The rich menu UI lives in the React shadow-root overlay, not here.)
 */
export interface BadgeRing {
  host: HTMLElement;
  setStatus: (status: RingStatus) => void;
}

/**
 * Encapsulated styles for the ring. `:host { all: initial }` isolates it from the page.
 * The ring sits one z-index below the menu so the menu always stacks above it.
 */
const RING_STYLES = `
  :host {
    all: initial;
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2147483646;
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

/** Builds a status ring for one image; clicking it opens the menu anchored to the ring. */
export function createBadgeRing(src: string): BadgeRing {
  const host = document.createElement('div');
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
    const rect = host.getBoundingClientRect();
    openMenu(src, {
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
  });

  shadow.append(style, ring);

  return {
    host,
    setStatus: (status) => {
      ring.className = `ring ${status}`;
    },
  };
}
