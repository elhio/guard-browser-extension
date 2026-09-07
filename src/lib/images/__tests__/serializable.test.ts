import { describe, it, expect } from 'vitest';

import { toSerializableCandidate } from '../serializable';
import type { ImageCandidate } from '../types';

/**
 * Stands in for a live `<img>`. It carries an own function property so that `structuredClone`
 * rejects it with `DataCloneError`, exactly as it rejects a real DOM node — a plain object would
 * clone happily and the test below would have no teeth.
 */
function fakeElement(): HTMLImageElement {
  return {
    currentSrc: 'https://example.com/a.jpg',
    getBoundingClientRect: () => ({ width: 200, height: 200 })
  } as unknown as HTMLImageElement;
}

function candidate(overrides: Partial<ImageCandidate> = {}): ImageCandidate {
  const element = fakeElement();
  return {
    src: 'https://example.com/a.jpg',
    element,
    elements: [element],
    fileName: 'a.jpg',
    fileExtension: 'jpg',
    ...overrides
  };
}

describe('toSerializableCandidate', () => {
  it('keeps only the primitive fields', () => {
    expect(toSerializableCandidate(candidate())).toEqual({
      src: 'https://example.com/a.jpg',
      fileName: 'a.jpg',
      fileExtension: 'jpg'
    });
  });

  it('drops every DOM reference, including a multi-element group', () => {
    const elements = [fakeElement(), fakeElement(), fakeElement()];
    const serializable = toSerializableCandidate(candidate({ element: elements[0], elements }));

    expect(serializable).not.toHaveProperty('element');
    expect(serializable).not.toHaveProperty('elements');
  });

  it('survives structuredClone', () => {
    // Firefox and Safari structured-clone extension messages and throw `DataCloneError` on a DOM
    // node, which killed classification there while Chrome's JSON path hid the same bug.
    expect(() => structuredClone(toSerializableCandidate(candidate()))).not.toThrow();
  });
});
