import { createBadgeRing, type BadgeRing } from './badgeElement';
import { collectClipAncestors, clipRectOf, viewportRect } from './clipChain';
import {
  anchorRectFor,
  hasMoved,
  makeRect,
  placeRing,
  type Rect,
  type RingPlacement,
} from './badgeGeometry';
import { closeMenu, getSnapshot, openMenu, updateAnchor, type RingStatus } from './store';

/** Public handle handed back to `attachBadge`; the layer owns everything else about the ring. */
export interface TrackedRing {
  setStatus(status: RingStatus): void;
}

interface Entry {
  target: HTMLImageElement;
  src: string;
  status: RingStatus;
  /** Live only while the image is near the viewport; recreated on re-entry from `status`. */
  ring?: BadgeRing;
  /** Ancestors that crop this image. Built lazily on first visibility (see `ensureClipChain`). */
  clips?: Element[];
  /** The parent the clip chain was built against, so a reparent can invalidate it cheaply. */
  clipsParent?: Element | null;
  intersecting: boolean;
  placement?: RingPlacement;
}

/** Ring creation is gated on being near the viewport, not strictly inside it. */
const INTERSECTION_MARGIN = '200px';

/** Safety-tick bounds, in ms. See `runTick` for why a tick is needed at all. */
const TICK_MIN_MS = 500;
const TICK_MAX_MS = 2000;
/** Consecutive unchanged ticks before the interval backs off. */
const IDLE_TICKS_BEFORE_BACKOFF = 3;

const entries = new Map<HTMLImageElement, Entry>();

let layer: HTMLElement | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let imageResizeObserver: ResizeObserver | null = null;
let clipResizeObserver: ResizeObserver | null = null;
let listening = false;

let rafId = 0;
let tickTimer: ReturnType<typeof setTimeout> | null = null;
let tickDelayMs = TICK_MIN_MS;
let idleTicks = 0;
/** Set when a clip chain is rebuilt or an entry drops, so the sweep re-observes the right set. */
let clipsDirty = false;

// ---- Layer lifecycle ----

/**
 * Creates the overlay layer inside the guard shadow root. Idempotent; call once after the shadow
 * UI mounts.
 *
 * `contain: layout paint` is the guarantee that matters: whatever this layer does to its own
 * subtree, it can never invalidate the host page's layout. `pointer-events: none` keeps the page
 * clickable through it; each ring opts itself back in.
 */
export function ensureBadgeLayer(shadow: ShadowRoot): void {
  if (layer?.isConnected) return;

  layer = document.createElement('div');
  layer.setAttribute('data-guard-badge-layer', '');
  layer.style.cssText =
    'position:fixed;inset:0;pointer-events:none;contain:layout paint;z-index:1;';
  shadow.append(layer);

  // Any rings created before the layer existed are still pending; place them now
  scheduleReposition();
}

/** Tears the layer down completely. For `ctx.onInvalidated`. */
export function destroyBadgeLayer(): void {
  clearAllBadges();
  layer?.remove();
  layer = null;
}

/**
 * Registers an image so it gets a ring. Idempotent per element.
 *
 * @param target - The image to badge.
 * @param src - The image's resolved URL, used to key the shared menu's state.
 */
export function trackImage(target: HTMLImageElement, src: string): TrackedRing {
  let entry = entries.get(target);

  // A virtualised feed (YouTube, Reddit) recycles one <img> for a new URL. Without this the entry
  // keeps the URL it was created with, so the ring would report a different image's verdict.
  if (entry && entry.src !== src) {
    entry.src = src;
    entry.status = 'processing';
    entry.ring?.setStatus('processing');
  }

  if (!entry) {
    entry = { target, src, status: 'processing', intersecting: false };
    entries.set(target, entry);

    ensureObservers();
    ensureListeners();
    intersectionObserver?.observe(target);
    imageResizeObserver?.observe(target);
    scheduleReposition();
    ensureTick();
  }

  const tracked = entry;
  return {
    setStatus(status: RingStatus) {
      tracked.status = status;
      tracked.ring?.setStatus(status);
    },
  };
}

/** Stops tracking one image and removes its ring. */
export function untrackImage(target: HTMLImageElement): void {
  const entry = entries.get(target);
  if (!entry) return;

  intersectionObserver?.unobserve(target);
  imageResizeObserver?.unobserve(target);
  removeRing(entry);
  entries.delete(target);
  clipsDirty = true;
}

/**
 * Drops every tracked image and its ring, and stops all observation. The layer element itself is
 * kept so the extension can be switched back on without re-mounting the shadow UI.
 */
export function clearAllBadges(): void {
  for (const entry of entries.values()) removeRing(entry);
  entries.clear();

  intersectionObserver?.disconnect();
  imageResizeObserver?.disconnect();
  clipResizeObserver?.disconnect();
  intersectionObserver = imageResizeObserver = clipResizeObserver = null;

  removeListeners();

  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (tickTimer !== null) {
    clearTimeout(tickTimer);
    tickTimer = null;
  }
  tickDelayMs = TICK_MIN_MS;
  idleTicks = 0;
  clipsDirty = false;
}

function createRing(entry: Entry): void {
  if (!layer || entry.ring) return;

  const ring = createBadgeRing(() => activateMenu(entry));
  ring.setStatus(entry.status);
  layer.append(ring.host);

  entry.ring = ring;
  // Force the next write, since the host starts at the layer's origin.
  entry.placement = undefined;
}

function removeRing(entry: Entry): void {
  entry.ring?.host.remove();
  entry.ring = undefined;
  entry.placement = undefined;
}

/** Opens the menu for a clicked ring, anchored to the image's currently visible box. */
function activateMenu(entry: Entry): void {
  const anchor = currentAnchor(entry);
  if (anchor) openMenu(entry.src, anchor);
}

function currentAnchor(entry: Entry): Rect | null {
  if (!entry.target.isConnected) return null;
  ensureClipChain(entry);
  const rect = entry.target.getBoundingClientRect();
  return anchorRectFor(
    makeRect(rect.left, rect.top, rect.width, rect.height),
    clipRectsFor(entry, viewportRect())
  );
}

/**
 * Every rectangle that crops this image, viewport first.
 *
 * `viewport` is passed in rather than read here so a whole pass shares one measurement, and `memo`
 * lets a grid of cards inside one scroller read that scroller's rect once instead of per image.
 */
function clipRectsFor(entry: Entry, viewport: Rect, memo?: Map<Element, Rect>): Rect[] {
  const rects: Rect[] = [viewport];
  for (const ancestor of entry.clips ?? []) {
    let rect = memo?.get(ancestor);
    if (!rect) {
      rect = clipRectOf(ancestor);
      memo?.set(ancestor, rect);
    }
    rects.push(rect);
  }
  return rects;
}

/**
 * Builds (or rebuilds) an image's clip-ancestor chain.
 *
 * This is the one expensive step — a `getComputedStyle` per ancestor — so it runs only when the
 * chain is missing or provably stale, never unconditionally inside the pass. Measured chain depth
 * on tagesschau is 2.2 on average, 3 at most.
 */
function ensureClipChain(entry: Entry): void {
  const parent = entry.target.parentElement;
  const fresh =
    entry.clips !== undefined &&
    entry.clipsParent === parent &&
    entry.clips.every((ancestor) => ancestor.isConnected);
  if (fresh) return;

  entry.clips = collectClipAncestors(entry.target);
  entry.clipsParent = parent;
  clipsDirty = true;
}

/** Queues a pass for the next frame. Cheap to call repeatedly; passes coalesce. */
export function scheduleReposition(): void {
  // Any real signal means the page is moving again, so leave the backed-off tick interval.
  tickDelayMs = TICK_MIN_MS;
  idleTicks = 0;

  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    runPass();
  });
}

/**
 * One placement pass, strictly two-phase: every rect is read before any style is written, so the
 * pass costs at most a single forced layout flush no matter how many rings it moves.
 *
 * @returns Whether anything actually changed, which drives the safety tick's backoff.
 */
function runPass(): boolean {
  if (!layer || entries.size === 0) return false;

  const openSrc = getSnapshot().openTarget?.src ?? null;
  const viewport = viewportRect();
  const memo = new Map<Element, Rect>();

  // --- Read phase: rects only, no writes. ---
  const pending: { entry: Entry; placement: RingPlacement; anchor?: Rect | null }[] = [];

  for (const entry of entries.values()) {
    if (!entry.intersecting || !entry.target.isConnected) {
      pending.push({ entry, placement: { x: 0, y: 0, visible: false } });
      continue;
    }

    ensureClipChain(entry);

    const rect = entry.target.getBoundingClientRect();
    const imageRect = makeRect(rect.left, rect.top, rect.width, rect.height);
    const clipRects = clipRectsFor(entry, viewport, memo);

    pending.push({
      entry,
      placement: placeRing(imageRect, clipRects),
      anchor: entry.src === openSrc ? anchorRectFor(imageRect, clipRects) : undefined,
    });
  }

  // --- Write phase. ---
  let changed = false;

  for (const { entry, placement } of pending) {
    if (entry.intersecting && entry.target.isConnected) {
      if (!entry.ring) createRing(entry);
    } else if (entry.ring) {
      removeRing(entry);
      changed = true;
    }

    if (!entry.ring) continue;

    if (hasMoved(entry.placement, placement)) {
      const host = entry.ring.host;
      host.style.display = placement.visible ? '' : 'none';
      if (placement.visible) {
        host.style.transform = `translate3d(${placement.x}px, ${placement.y}px, 0)`;
      }
      changed = true;
    }
    entry.placement = placement;
  }

  // Keep the open menu on the same visible box the ring uses, so the two can never disagree. An
  // absent anchor means the image scrolled out of view or left the page, which closes the menu.
  if (openSrc !== null) {
    const anchor = pending.find((item) => item.entry.src === openSrc)?.anchor ?? null;
    if (anchor === null) closeMenu();
    else updateAnchor(openSrc, anchor);
  }

  return changed;
}

function ensureObservers(): void {
  intersectionObserver ??= new IntersectionObserver(
    (records) => {
      for (const record of records) {
        const entry = entries.get(record.target as HTMLImageElement);
        if (entry) entry.intersecting = record.isIntersecting;
      }
      scheduleReposition();
    },
    { root: null, rootMargin: INTERSECTION_MARGIN, threshold: 0 }
  );

  // Catches lazy images gaining layout, container queries, and size transitions on the image.
  imageResizeObserver ??= new ResizeObserver(() => scheduleReposition());
  // Catches accordions, sibling collapse, and anything resizing a scroller or the document.
  clipResizeObserver ??= new ResizeObserver(() => scheduleReposition());
}

const onReposition = () => scheduleReposition();

function onVisibilityChange(): void {
  if (document.hidden) {
    if (tickTimer !== null) {
      clearTimeout(tickTimer);
      tickTimer = null;
    }
    return;
  }
  scheduleReposition();
  ensureTick();
}

function ensureListeners(): void {
  if (listening) return;
  listening = true;

  // `capture: true` is what picks up nested scrollers: scroll does not bubble, but it does capture.
  document.addEventListener('scroll', onReposition, { capture: true, passive: true });
  window.addEventListener('resize', onReposition);
  // Layout-viewport changes only (iOS URL bar, on-screen keyboard). Deliberately no offset maths:
  // `position: fixed` and `getBoundingClientRect()` share the layout viewport, so pinch-zoom
  // already keeps rings glued, and "correcting" for visualViewport offsets would break it.
  window.visualViewport?.addEventListener('resize', onReposition);
  window.visualViewport?.addEventListener('scroll', onReposition);
  window.addEventListener('pageshow', onReposition);
  window.addEventListener('popstate', onReposition);
  window.addEventListener('hashchange', onReposition);
  document.addEventListener('visibilitychange', onVisibilityChange);
  // A fullscreened element paints in the top layer, above our fixed layer whatever its z-index.
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  // The single biggest relayout that fires no scroll or resize event.
  document.fonts?.ready.then(onReposition).catch(() => {});
}

function removeListeners(): void {
  if (!listening) return;
  listening = false;

  document.removeEventListener('scroll', onReposition, { capture: true });
  window.removeEventListener('resize', onReposition);
  window.visualViewport?.removeEventListener('resize', onReposition);
  window.visualViewport?.removeEventListener('scroll', onReposition);
  window.removeEventListener('pageshow', onReposition);
  window.removeEventListener('popstate', onReposition);
  window.removeEventListener('hashchange', onReposition);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
}

function onFullscreenChange(): void {
  if (!layer) return;
  const host = layer.getRootNode() as ShadowRoot;
  const fullscreen = document.fullscreenElement;
  // Hide while something else owns the top layer; our rings would be invisible anyway.
  layer.style.visibility = fullscreen && !fullscreen.contains(host.host) ? 'hidden' : '';
  scheduleReposition();
}

function ensureTick(): void {
  if (tickTimer !== null || document.hidden) return;
  tickTimer = setTimeout(runTick, tickDelayMs);
}

/**
 * The safety tick, which also does garbage collection.
 *
 * `ResizeObserver` reports size, not position, so an image that merely *moves* — an accordion
 * opening above it, a transform animation on an ancestor — fires no event at all. Rather than
 * burning a permanent `requestAnimationFrame` loop (which would defeat browser idling and show up
 * in battery audits), this polls at 500 ms and backs off to 2 s once nothing has changed for three
 * ticks, resetting the moment any real signal arrives.
 */
function runTick(): void {
  tickTimer = null;
  if (entries.size === 0) return;

  sweep();
  const changed = runPass();

  if (changed) {
    tickDelayMs = TICK_MIN_MS;
    idleTicks = 0;
  } else if (++idleTicks >= IDLE_TICKS_BEFORE_BACKOFF) {
    tickDelayMs = Math.min(tickDelayMs * 2, TICK_MAX_MS);
    idleTicks = 0;
  }

  ensureTick();
}

/** Drops entries whose image left the page, and re-syncs which clip ancestors are observed. */
function sweep(): void {
  for (const entry of [...entries.values()]) {
    if (!entry.target.isConnected) untrackImage(entry.target);
  }

  if (!clipsDirty || !clipResizeObserver) return;
  clipsDirty = false;

  // Rebuilt wholesale rather than refcounted: clip ancestors are shared between images, and a
  // ResizeObserver holds a strong reference, so a long-lived feed would otherwise retain removed
  // scrollers forever.
  clipResizeObserver.disconnect();
  const observed = new Set<Element>();
  for (const entry of entries.values()) {
    for (const ancestor of entry.clips ?? []) {
      if (observed.has(ancestor)) continue;
      observed.add(ancestor);
      clipResizeObserver.observe(ancestor);
    }
  }
  if (document.documentElement.isConnected) clipResizeObserver.observe(document.documentElement);
}
