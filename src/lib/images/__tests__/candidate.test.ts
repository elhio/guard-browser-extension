import { describe, it, expect } from 'vitest';

import { getFileNameFromUrl, getFileExtension, toImageCandidate } from '../candidate';

describe('getFileNameFromUrl', () => {
  it('returns the last path segment', () => {
    expect(getFileNameFromUrl('https://example.com/images/photo.jpg')).toBe('photo.jpg');
  });

  it('ignores the query string', () => {
    expect(getFileNameFromUrl('https://example.com/a/b/pic.png?w=200&h=100')).toBe('pic.png');
  });

  it('returns an empty string for a trailing slash (no file segment)', () => {
    expect(getFileNameFromUrl('https://example.com/images/')).toBe('');
  });

  it('returns an empty string for a malformed URL', () => {
    expect(getFileNameFromUrl('not a url')).toBe('');
  });
});

describe('getFileExtension', () => {
  it('lowercases the extension', () => {
    expect(getFileExtension('photo.JPG')).toBe('jpg');
  });

  it('returns an empty string when there is no dot', () => {
    expect(getFileExtension('photo')).toBe('');
  });

  it('returns an empty string for a trailing dot', () => {
    expect(getFileExtension('photo.')).toBe('');
  });

  it('uses only the final extension', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
  });
});

describe('toImageCandidate', () => {
  it('assembles src, fileName and fileExtension', () => {
    const candidate = toImageCandidate('https://example.com/dir/cat.WEBP');
    expect(candidate).toMatchObject({
      src: 'https://example.com/dir/cat.WEBP',
      fileName: 'cat.WEBP',
      fileExtension: 'webp',
    });
    expect(candidate.element).toBeUndefined();
  });
});
