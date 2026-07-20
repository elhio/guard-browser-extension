import { describe, it, expect } from 'vitest';

import { isNewerVersion } from '../appStore';

describe('isNewerVersion', () => {
  it('is true when a later segment increases', () => {
    expect(isNewerVersion('0.0.2', '0.0.1')).toBe(true);
    expect(isNewerVersion('0.1.0', '0.0.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true);
  });

  it('is false for equal or older versions', () => {
    expect(isNewerVersion('0.0.1', '0.0.1')).toBe(false);
    expect(isNewerVersion('0.0.1', '0.0.2')).toBe(false);
    expect(isNewerVersion('1.2.0', '1.10.0')).toBe(false); // 2 < 10, not string-compared
  });

  it('treats missing segments as zero', () => {
    expect(isNewerVersion('1.0.1', '1')).toBe(true);
    expect(isNewerVersion('1', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.0', '1.0.0')).toBe(false);
  });
});
