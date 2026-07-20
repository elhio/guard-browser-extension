import { describe, it, expect } from 'vitest';

import {
  byHttpSource,
  bySupportedFormat,
  byMinRenderedSize,
  combineFilters,
} from '../filters';
import type { ImageCandidate } from '../types';

/** Builds a minimal candidate; `element` is faked only with what the filters read. */
function candidate(
  src: string,
  fileExtension = '',
  element?: Partial<HTMLImageElement>
): ImageCandidate {
  return {
    src,
    fileName: '',
    fileExtension,
    element: element as HTMLImageElement | undefined,
  };
}

/** A fake <img> exposing just the geometry `byMinRenderedSize` inspects. */
function fakeImage(rendered: number, natural = 0): Partial<HTMLImageElement> {
  return {
    getBoundingClientRect: () => ({ width: rendered, height: rendered }) as DOMRect,
    naturalWidth: natural,
    naturalHeight: natural,
  };
}

describe('byHttpSource', () => {
  const filter = byHttpSource();

  it('keeps http and https sources', () => {
    expect(filter(candidate('http://example.com/a.png'))).toBe(true);
    expect(filter(candidate('https://example.com/a.png'))).toBe(true);
  });

  it('drops non-http schemes', () => {
    expect(filter(candidate('data:image/png;base64,iVBOR'))).toBe(false);
    expect(filter(candidate('blob:https://example.com/uuid'))).toBe(false);
    expect(filter(candidate('file:///Users/me/a.png'))).toBe(false);
  });
});

describe('bySupportedFormat', () => {
  const filter = bySupportedFormat();

  it('rejects vector/icon formats', () => {
    expect(filter(candidate('x', 'svg'))).toBe(false);
    expect(filter(candidate('x', 'ico'))).toBe(false);
  });

  it('keeps raster formats and extensionless URLs', () => {
    expect(filter(candidate('x', 'png'))).toBe(true);
    expect(filter(candidate('x', 'jpg'))).toBe(true);
    expect(filter(candidate('x', ''))).toBe(true);
  });
});

describe('byMinRenderedSize', () => {
  const filter = byMinRenderedSize(64);

  it('keeps images at or above the minimum', () => {
    expect(filter(candidate('x', '', fakeImage(64)))).toBe(true);
    expect(filter(candidate('x', '', fakeImage(200)))).toBe(true);
  });

  it('drops images below the minimum', () => {
    expect(filter(candidate('x', '', fakeImage(16)))).toBe(false);
  });

  it('falls back to the intrinsic size when not rendered', () => {
    expect(filter(candidate('x', '', fakeImage(0, 300)))).toBe(true);
    expect(filter(candidate('x', '', fakeImage(0, 10)))).toBe(false);
  });

  it('keeps unmeasurable images (no layout yet) and elementless candidates', () => {
    expect(filter(candidate('x', '', fakeImage(0, 0)))).toBe(true);
    expect(filter(candidate('x', ''))).toBe(true);
  });
});

describe('combineFilters', () => {
  it('passes only when every child filter passes (AND semantics)', () => {
    const combined = combineFilters([byHttpSource(), bySupportedFormat()]);
    expect(combined(candidate('https://example.com/a.png', 'png'))).toBe(true);
    expect(combined(candidate('https://example.com/a.svg', 'svg'))).toBe(false);
    expect(combined(candidate('data:image/png;base64,x', 'png'))).toBe(false);
  });
});
