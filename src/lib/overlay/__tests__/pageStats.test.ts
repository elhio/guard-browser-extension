import { describe, it, expect, beforeEach } from 'vitest';

import {
  clearOverlayState,
  getPageStats,
  markProcessing,
  setErrorState,
  setResult,
} from '../store';
import type { ClassifyImageResult } from '@/lib/messaging/classifyMessages';

// The store only holds the element as an opaque value, so a bare stub is enough here.
const el = {} as HTMLImageElement;

/** Minimal success result; getPageStats only ever reads the entry status, not this payload. */
function successResult(src: string): Extract<ClassifyImageResult, { status: 'success' }> {
  return { status: 'success', src, categories: {} } as Extract<
    ClassifyImageResult,
    { status: 'success' }
  >;
}

describe('getPageStats', () => {
  beforeEach(() => {
    clearOverlayState();
  });

  it('counts nothing on an empty page', () => {
    expect(getPageStats()).toEqual({ checked: 0, flagged: 0 });
  });

  it('excludes in-flight (processing) images from the counts', () => {
    markProcessing('a', el);
    expect(getPageStats()).toEqual({ checked: 0, flagged: 0 });
  });

  it('counts idle as checked and alert as checked + flagged, and ignores errors', () => {
    markProcessing('a', el);
    setResult('a', el, successResult('a'), false); // idle → checked
    setResult('b', el, successResult('b'), true); // alert → checked + flagged
    setResult('c', el, successResult('c'), true); // alert → checked + flagged
    setErrorState('d', el, 'boom'); // error → excluded
    markProcessing('e', el); // still processing → excluded

    expect(getPageStats()).toEqual({ checked: 3, flagged: 2 });
  });

  it('reflects an image transitioning from processing to flagged', () => {
    markProcessing('a', el);
    expect(getPageStats()).toEqual({ checked: 0, flagged: 0 });
    setResult('a', el, successResult('a'), true);
    expect(getPageStats()).toEqual({ checked: 1, flagged: 1 });
  });
});
