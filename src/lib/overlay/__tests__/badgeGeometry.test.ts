import { describe, it, expect } from 'vitest';

import {
  makeRect,
  intersectRects,
  intersectAll,
  placeRing,
  anchorRectFor,
  hasMoved,
  RING_SIZE_PX,
  RING_INSET_PX,
  MIN_VISIBLE_PX,
} from '../badgeGeometry';

/** A 1000x800 viewport, the outermost clip in every realistic placement. */
const VIEWPORT = makeRect(0, 0, 1000, 800);

describe('intersectRects', () => {
  it('returns the overlap of two crossing rects', () => {
    const result = intersectRects(makeRect(0, 0, 100, 100), makeRect(50, 50, 100, 100));
    expect(result).toEqual(makeRect(50, 50, 50, 50));
  });

  it('returns a zero-sized rect for disjoint inputs, never a negative one', () => {
    const result = intersectRects(makeRect(0, 0, 10, 10), makeRect(500, 500, 10, 10));
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
    expect(result.right).toBeGreaterThanOrEqual(result.left);
    expect(result.bottom).toBeGreaterThanOrEqual(result.top);
  });

  it('treats edge-touching rects as empty', () => {
    const result = intersectRects(makeRect(0, 0, 100, 100), makeRect(100, 0, 100, 100));
    expect(result.width).toBe(0);
  });

  it('returns the inner rect when one fully contains the other', () => {
    const inner = makeRect(20, 20, 30, 30);
    expect(intersectRects(makeRect(0, 0, 100, 100), inner)).toEqual(inner);
  });
});

describe('intersectAll', () => {
  it('folds over every rect', () => {
    const result = intersectAll([
      makeRect(0, 0, 100, 100),
      makeRect(10, 10, 100, 100),
      makeRect(0, 0, 40, 90),
    ]);
    expect(result).toEqual(makeRect(10, 10, 30, 80));
  });

  it('stays empty once any pair is disjoint', () => {
    const result = intersectAll([
      makeRect(0, 0, 100, 100),
      makeRect(500, 0, 100, 100),
      makeRect(0, 0, 100, 100),
    ]);
    expect(result.width).toBe(0);
  });
});

describe('placeRing', () => {
  it('anchors to the top-right of an unclipped image', () => {
    const image = makeRect(100, 200, 400, 300);
    const placement = placeRing(image, [VIEWPORT]);

    expect(placement.visible).toBe(true);
    expect(placement.x).toBe(image.right - RING_SIZE_PX - RING_INSET_PX);
    expect(placement.y).toBe(image.top + RING_INSET_PX);
  });

  it('tracks the clip edge, not the image edge, when a carousel crops the right side', () => {
    const image = makeRect(100, 200, 400, 300);
    const carousel = makeRect(0, 0, 300, 800);

    const placement = placeRing(image, [VIEWPORT, carousel]);

    expect(placement.visible).toBe(true);
    expect(placement.x).toBe(carousel.right - RING_SIZE_PX - RING_INSET_PX);
  });

  it('pins to the clip top when the image is scrolled halfway out of its scroller', () => {
    const image = makeRect(100, -150, 400, 300);
    const scroller = makeRect(0, 0, 1000, 400);

    const placement = placeRing(image, [VIEWPORT, scroller]);

    expect(placement.visible).toBe(true);
    expect(placement.y).toBe(scroller.top + RING_INSET_PX);
  });

  it('pins to the viewport top for an image taller than the viewport', () => {
    const image = makeRect(0, -500, 1000, 2000);
    const placement = placeRing(image, [VIEWPORT]);

    expect(placement.visible).toBe(true);
    expect(placement.y).toBe(RING_INSET_PX);
  });

  it('hides the ring when the image lies entirely outside its clip', () => {
    const image = makeRect(900, 200, 400, 300);
    const carousel = makeRect(0, 0, 300, 800);

    expect(placeRing(image, [VIEWPORT, carousel]).visible).toBe(false);
  });

  it('hides the ring when too little of the image is visible to hold one', () => {
    const image = makeRect(0, 0, 400, 300);
    const sliver = makeRect(0, 0, MIN_VISIBLE_PX - 10, MIN_VISIBLE_PX - 10);

    expect(placeRing(image, [VIEWPORT, sliver]).visible).toBe(false);
  });

  it('hides the ring for a zero-sized (lazy or display:none) image', () => {
    expect(placeRing(makeRect(0, 0, 0, 0), [VIEWPORT]).visible).toBe(false);
  });

  it('always keeps the ring box fully inside the visible box', () => {
    const clips = [
      makeRect(0, 0, 120, 90),
      makeRect(40, 30, 500, 500),
      makeRect(-20, -20, 200, 200),
    ];

    for (const clip of clips) {
      for (let left = -200; left <= 200; left += 37) {
        for (let top = -200; top <= 200; top += 41) {
          const image = makeRect(left, top, 260, 180);
          const placement = placeRing(image, [VIEWPORT, clip]);
          if (!placement.visible) continue;

          const visible = intersectAll([image, VIEWPORT, clip]);
          expect(placement.x).toBeGreaterThanOrEqual(visible.left);
          expect(placement.y).toBeGreaterThanOrEqual(visible.top);
          expect(placement.x + RING_SIZE_PX).toBeLessThanOrEqual(visible.right);
          expect(placement.y + RING_SIZE_PX).toBeLessThanOrEqual(visible.bottom);
        }
      }
    }
  });
});

describe('anchorRectFor', () => {
  it('returns the visible box, not the raw image rect', () => {
    const image = makeRect(100, 200, 400, 300);
    const carousel = makeRect(0, 0, 300, 800);

    expect(anchorRectFor(image, [VIEWPORT, carousel])).toEqual(makeRect(100, 200, 200, 300));
  });

  it('returns null exactly when the ring would be hidden', () => {
    const image = makeRect(900, 200, 400, 300);
    const carousel = makeRect(0, 0, 300, 800);

    expect(anchorRectFor(image, [VIEWPORT, carousel])).toBeNull();
    expect(anchorRectFor(makeRect(0, 0, 0, 0), [VIEWPORT])).toBeNull();
  });
});

describe('hasMoved', () => {
  const at = (x: number, y: number) => ({ x, y, visible: true });

  it('reports a first placement as moved', () => {
    expect(hasMoved(undefined, at(0, 0))).toBe(true);
  });

  it('ignores sub-epsilon drift but reports real movement', () => {
    expect(hasMoved(at(10, 10), at(10.4, 10.4))).toBe(false);
    expect(hasMoved(at(10, 10), at(10.6, 10))).toBe(true);
  });

  it('reports a visibility flip in either direction', () => {
    const hidden: ReturnType<typeof at> = { x: 0, y: 0, visible: false };
    expect(hasMoved(at(10, 10), hidden)).toBe(true);
    expect(hasMoved(hidden, at(10, 10))).toBe(true);
  });

  it('ignores coordinate changes while hidden', () => {
    expect(hasMoved({ x: 0, y: 0, visible: false }, { x: 999, y: 999, visible: false })).toBe(false);
  });
});
