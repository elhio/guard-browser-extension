import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { watchPageImages } from '../watchPageImages';
import type { ImageCandidate } from '../types';

/** A fake <img> exposing only what the scanner reads. */
function fakeImage(currentSrc: string): HTMLImageElement {
  return {
    currentSrc,
    src: '',
    getBoundingClientRect: () => ({ width: 200, height: 200 }) as DOMRect,
    naturalWidth: 0,
    naturalHeight: 0
  } as unknown as HTMLImageElement;
}

/** A mutable scan root, so a test can add elements between scans. */
function mutableRoot(images: HTMLImageElement[]) {
  return { querySelectorAll: () => images } as unknown as Element;
}

const originals = {
  MutationObserver: globalThis.MutationObserver,
  document: globalThis.document
};

/** Fires the callback the watcher handed to its MutationObserver, i.e. simulates a DOM change. */
let notifyMutation: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  notifyMutation = undefined;
  // `watchPageImages` observes `document.documentElement`; the scan itself uses the injected root.
  (globalThis as { MutationObserver?: unknown }).MutationObserver = class {
    constructor(callback: () => void) {
      notifyMutation = callback;
    }
    observe(): void {}
    disconnect(): void {}
  };
  (globalThis as { document?: unknown }).document = { documentElement: {} };
});

afterEach(() => {
  vi.useRealTimers();
  (globalThis as { MutationObserver?: unknown }).MutationObserver = originals.MutationObserver;
  (globalThis as { document?: unknown }).document = originals.document;
});

describe('watchPageImages', () => {
  it('reports every element of a repeated URL on the first scan', () => {
    const first = fakeImage('https://a/dup.jpg');
    const second = fakeImage('https://a/dup.jpg');
    const batches: ImageCandidate[][] = [];

    const stop = watchPageImages({ root: mutableRoot([first, second]), onNewCandidates: (c) => batches.push(c) });
    stop();

    expect(batches).toHaveLength(1);
    expect(batches[0][0].elements).toEqual([first, second]);
  });

  it('reports only the new element when a copy of a reported URL appears later', () => {
    const first = fakeImage('https://a/dup.jpg');
    const images = [first];
    const batches: ImageCandidate[][] = [];

    const stop = watchPageImages({ root: mutableRoot(images), onNewCandidates: (c) => batches.push(c) });

    // A second copy of the same URL appears after the first scan (a carousel clone, an SPA re-render).
    const second = fakeImage('https://a/dup.jpg');
    images.push(second);
    notifyMutation?.();
    vi.advanceTimersByTime(500);
    stop();

    expect(batches).toHaveLength(2);
    expect(batches[0][0].elements).toEqual([first]);
    // Narrowed to the newcomer, so the already-classified copy is not reset to `processing`.
    expect(batches[1][0].elements).toEqual([second]);
  });

  it('stays silent on a rescan when nothing new appeared', () => {
    const image = fakeImage('https://a/1.jpg');
    const batches: ImageCandidate[][] = [];

    const stop = watchPageImages({ root: mutableRoot([image]), onNewCandidates: (c) => batches.push(c) });

    notifyMutation?.();
    vi.advanceTimersByTime(500);
    stop();

    expect(batches).toHaveLength(1);
    expect(batches[0][0].element).toBe(image);
  });

  it('reports a recycled element again once its URL changes', () => {
    const image = fakeImage('https://a/first.jpg');
    const batches: ImageCandidate[][] = [];

    const stop = watchPageImages({ root: mutableRoot([image]), onNewCandidates: (c) => batches.push(c) });

    // A virtualised feed reuses the same <img> for a different video/post.
    (image as { currentSrc: string }).currentSrc = 'https://a/second.jpg';
    notifyMutation?.();
    vi.advanceTimersByTime(500);
    stop();

    expect(batches.map((batch) => batch[0].src)).toEqual(['https://a/first.jpg', 'https://a/second.jpg']);
  });
});
