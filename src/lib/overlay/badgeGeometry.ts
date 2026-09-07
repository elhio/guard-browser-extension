/**
 * Pure geometry for placing badge rings in the viewport-fixed overlay layer.
 *
 * Nothing here touches the DOM: every function takes plain rectangles in viewport coordinates and
 * returns plain data. That keeps the whole placement algorithm unit-testable under vitest's default
 * `node` environment (this project installs no jsdom, and jsdom has no layout engine anyway, so it
 * could never exercise real geometry).
 */

/** A rectangle in viewport coordinates. Structurally compatible with `DOMRect`. */
export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Where a ring should be drawn this pass, in viewport coordinates. */
export interface RingPlacement {
  /** Viewport x of the ring box's left edge. Meaningless when `visible` is false. */
  x: number;
  /** Viewport y of the ring box's top edge. Meaningless when `visible` is false. */
  y: number;
  /** False when the ring must not be rendered at all this pass. */
  visible: boolean;
}

/** Rendered size of a ring, in CSS pixels. Must match `:host` in `badgeElement.ts`. */
export const RING_SIZE_PX = 24;

/** Gap between the ring and the corner of the box it sits in. */
export const RING_INSET_PX = 8;

/**
 * Smallest visible box that can still hold an inset ring. Below this the ring would overflow the
 * part of the image the user can actually see, so it is suppressed instead — this is what keeps
 * rings out of carousel gutters and off images cropped to a sliver by an `overflow: hidden` parent.
 */
export const MIN_VISIBLE_PX = RING_SIZE_PX + RING_INSET_PX * 2;

/** Movements smaller than this are not written to the DOM. */
export const MOVE_EPSILON_PX = 0.5;

const HIDDEN: RingPlacement = { x: 0, y: 0, visible: false };

/** Builds a `Rect` from a top-left corner and a size. */
export function makeRect(left: number, top: number, width: number, height: number): Rect {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

/**
 * The overlap of two rectangles. Disjoint inputs produce a zero-sized rect rather than a negative
 * one, so the result is always a valid `Rect` and callers can test `width`/`height` alone.
 */
export function intersectRects(a: Rect, b: Rect): Rect {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const width = Math.max(0, Math.min(a.right, b.right) - left);
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - top);
  return makeRect(left, top, width, height);
}

/** Folds `intersectRects` over a list. The first entry is the base rectangle. */
export function intersectAll(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return makeRect(0, 0, 0, 0);
  let result = rects[0];
  for (let i = 1; i < rects.length; i++) {
    result = intersectRects(result, rects[i]);
    // Once the overlap is empty it can never grow again.
    if (result.width === 0 || result.height === 0) return result;
  }
  return result;
}

/** Whether a rectangle has no area. */
export function isEmptyRect(rect: Rect): boolean {
  return rect.width <= 0 || rect.height <= 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The part of an image the user can actually see: the image's own box, intersected with every
 * ancestor that clips it and with the viewport. Returns an empty rect when nothing is visible.
 */
function visibleBoxOf(imageRect: Rect, clipRects: readonly Rect[]): Rect {
  return intersectAll([imageRect, ...clipRects]);
}

/**
 * Decides where an image's ring goes, or that it should not be drawn.
 *
 * The ring is anchored to the top-right of the *visible* box rather than the image's raw rect, so a
 * half-scrolled carousel slide keeps its ring inside the carousel instead of letting it escape into
 * the page. The final clamp is a no-op given `MIN_VISIBLE_PX`, but it makes "the ring always lies
 * fully inside the visible box" true by construction rather than by arithmetic coincidence.
 *
 * @param imageRect - The image's `getBoundingClientRect()`.
 * @param clipRects - Every clipping ancestor's rect, plus the viewport rect. Order is irrelevant.
 */
export function placeRing(imageRect: Rect, clipRects: readonly Rect[]): RingPlacement {
  // Not laid out yet (lazy image, `display: none`, closed <details>): no ring, no special casing.
  if (isEmptyRect(imageRect)) return HIDDEN;

  const visible = visibleBoxOf(imageRect, clipRects);
  if (visible.width < MIN_VISIBLE_PX || visible.height < MIN_VISIBLE_PX) return HIDDEN;

  const x = clamp(
    visible.right - RING_SIZE_PX - RING_INSET_PX,
    visible.left,
    visible.right - RING_SIZE_PX
  );
  const y = clamp(visible.top + RING_INSET_PX, visible.top, visible.bottom - RING_SIZE_PX);

  return { x, y, visible: true };
}

/**
 * The rect the menu should anchor to while it is open — the same visible box the ring is placed in,
 * so the two can never disagree. Returns `null` exactly when `placeRing` would hide the ring, which
 * is the signal to close the menu.
 */
export function anchorRectFor(imageRect: Rect, clipRects: readonly Rect[]): Rect | null {
  if (isEmptyRect(imageRect)) return null;
  const visible = visibleBoxOf(imageRect, clipRects);
  if (visible.width < MIN_VISIBLE_PX || visible.height < MIN_VISIBLE_PX) return null;
  return visible;
}

/** Whether a placement changed enough to be worth writing to the DOM. */
export function hasMoved(prev: RingPlacement | undefined, next: RingPlacement): boolean {
  if (!prev) return true;
  if (prev.visible !== next.visible) return true;
  if (!next.visible) return false;
  return (
    Math.abs(prev.x - next.x) >= MOVE_EPSILON_PX || Math.abs(prev.y - next.y) >= MOVE_EPSILON_PX
  );
}
