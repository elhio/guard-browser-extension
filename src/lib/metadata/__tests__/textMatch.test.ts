import { describe, it, expect } from 'vitest';

import { findMatchingTerm, hasAnyField } from '../textMatch';

describe('findMatchingTerm', () => {
  it('finds a term nested inside the metadata (case-insensitive)', () => {
    const metadata = { xmp: { CreatorTool: 'Made with Midjourney v6' } };
    expect(findMatchingTerm(metadata, ['midjourney'])).toBe('midjourney');
  });

  it('matches against keys as well as values', () => {
    const metadata = { DALLE: true };
    expect(findMatchingTerm(metadata, ['dalle'])).toBe('dalle');
  });

  it('returns the first matching term in the provided order', () => {
    const metadata = { note: 'stable diffusion output' };
    expect(findMatchingTerm(metadata, ['firefly', 'stable diffusion'])).toBe('stable diffusion');
  });

  it('returns null when nothing matches', () => {
    expect(findMatchingTerm({ note: 'a real photo' }, ['midjourney'])).toBeNull();
  });

  it('returns null for undefined metadata', () => {
    expect(findMatchingTerm(undefined, ['midjourney'])).toBeNull();
  });

  it('does not descend past the depth cap (4)', () => {
    // term sits at depth 6, beyond the depth-4 cap, so it is not flattened/searched.
    const deep = { a: { b: { c: { d: { e: { f: 'midjourney' } } } } } };
    expect(findMatchingTerm(deep, ['midjourney'])).toBeNull();
  });
});

describe('hasAnyField', () => {
  it('detects a top-level key case-insensitively', () => {
    expect(hasAnyField({ GPSLatitude: 1 }, ['gpslatitude'])).toBe(true);
  });

  it('returns false when no field name is present at the top level', () => {
    expect(hasAnyField({ Make: 'Canon' }, ['gpslatitude'])).toBe(false);
  });

  it('only inspects top-level keys, not nested ones', () => {
    expect(hasAnyField({ exif: { GPSLatitude: 1 } }, ['gpslatitude'])).toBe(false);
  });

  it('returns false for undefined metadata', () => {
    expect(hasAnyField(undefined, ['make'])).toBe(false);
  });
});
