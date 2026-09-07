import { makeRect, type Rect } from './badgeGeometry';

/**
 * Discovery of the ancestors that visually crop an image, so a ring can be kept inside the part of
 * its image the user can actually see.
 *
 * The decision logic is split out as a pure predicate; everything else here walks the DOM and is
 * deliberately kept to the two calls that need real layout.
 */

/**
 * Whether a box with these computed overflow values crops its descendants.
 *
 * Anything other than `visible` clips, which matches what browsers actually do: `hidden` and `clip`
 * crop outright, and `scroll`/`auto`/`overlay` crop everything outside the scrollport.
 */
export function clipsOverflow(overflowX: string, overflowY: string): boolean {
  return overflowX !== 'visible' || overflowY !== 'visible';
}

/**
 * The ancestors of `element` that crop it, nearest first. `element` itself is never included.
 *
 * `<body>` and `<html>` are skipped even when they clip. Overflow on the root element, or on `<body>`
 * when the root is `visible`, propagates to the viewport, so neither element's own border box is ever
 * the clip for its descendants — `viewportRect()` is, and it is already the first entry in the chain.
 * Including them is actively wrong on any page whose `<body>` border box does not span its content:
 * youtube.com sets `overflow-y: scroll` on a zero-height `<body>` (`ytd-app` is out of flow), which
 * collapsed every ring's visible box to nothing and hid all badges on the site.
 *
 * This calls `getComputedStyle` once per ancestor, so it must never run inside the per-frame
 * reposition pass — `badgeLayer` computes it the first time an image scrolls into view and caches
 * the result against that image.
 */
export function collectClipAncestors(element: Element): Element[] {
  const clippers: Element[] = [];
  let ancestor = element.parentElement;

  while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
    const style = getComputedStyle(ancestor);
    if (clipsOverflow(style.overflowX, style.overflowY)) clippers.push(ancestor);
    ancestor = ancestor.parentElement;
  }

  return clippers;
}

/**
 * The viewport as a clip rectangle.
 *
 * `documentElement.clientWidth/Height` is the layout viewport excluding scrollbars, unlike
 * `window.innerWidth/Height` which includes them and would let a ring sit under the scrollbar.
 * Including the viewport in the clip chain is what keeps the ring on an image taller than the
 * screen pinned to the top edge, and therefore reachable, instead of scrolling out of view.
 */
export function viewportRect(): Rect {
  return makeRect(0, 0, document.documentElement.clientWidth, document.documentElement.clientHeight);
}

/**
 * A clipping ancestor's rect.
 *
 * `overflow: hidden` actually crops at the padding box while this returns the border box, so a
 * bordered scroller is over-reported by its border width. Computing the true padding box would need
 * `clientLeft`/`clientWidth`, which are untransformed layout values and cannot be mixed with a
 * transformed `getBoundingClientRect()` without introducing a much worse error. Against an 8px ring
 * inset the border-width discrepancy is invisible, so this is the right trade — do not "fix" it.
 */
export function clipRectOf(element: Element): Rect {
  const rect = element.getBoundingClientRect();
  return makeRect(rect.left, rect.top, rect.width, rect.height);
}
