import { describe, it, expect } from 'vitest';

import { scanPageImages } from '../scanPageImages';
import { byMinRenderedSize } from '../filters';

/** A fake <img> exposing only what the scanner and the size filter read. */
function fakeImage(currentSrc: string, size = 200): HTMLImageElement {
  return {
    currentSrc,
    src: '',
    getBoundingClientRect: () => ({ width: size, height: size }) as DOMRect,
    naturalWidth: 0,
    naturalHeight: 0
  } as unknown as HTMLImageElement;
}

/** A fake scan root returning a fixed element list. */
function rootOf(images: HTMLImageElement[]) {
  return { querySelectorAll: () => images } as unknown as Element;
}

describe('scanPageImages', () => {
  it('returns one candidate per distinct URL', () => {
    const candidates = scanPageImages({ root: rootOf([fakeImage('https://a/1.jpg'), fakeImage('https://a/2.jpg')]) });

    expect(candidates.map((candidate) => candidate.src)).toEqual(['https://a/1.jpg', 'https://a/2.jpg']);
  });

  it('groups every element showing the same URL onto one candidate', () => {
    const first = fakeImage('https://a/dup.jpg');
    const second = fakeImage('https://a/dup.jpg');
    const third = fakeImage('https://a/dup.jpg');

    const candidates = scanPageImages({ root: rootOf([first, second, third]) });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].elements).toEqual([first, second, third]);
    // `element` stays the first one so existing single-element callers are unaffected.
    expect(candidates[0].element).toBe(first);
  });

  it('skips elements with no resolved source', () => {
    const candidates = scanPageImages({ root: rootOf([fakeImage(''), fakeImage('https://a/1.jpg')]) });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].src).toBe('https://a/1.jpg');
  });

  it('applies filters per element, so a too-small copy does not join the group', () => {
    const big = fakeImage('https://a/dup.jpg', 200);
    const tiny = fakeImage('https://a/dup.jpg', 16);

    const candidates = scanPageImages({ root: rootOf([big, tiny]), filters: [byMinRenderedSize(64)] });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].elements).toEqual([big]);
  });

  it('drops a URL entirely when its only element fails a filter', () => {
    const candidates = scanPageImages({ root: rootOf([fakeImage('https://a/tiny.jpg', 16)]), filters: [byMinRenderedSize(64)] });

    expect(candidates).toEqual([]);
  });
});
