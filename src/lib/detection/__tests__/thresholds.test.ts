import { describe, it, expect } from 'vitest';

import { passesThreshold, DETECTION_THRESHOLDS } from '../thresholds';

describe('passesThreshold', () => {
  it('passes at or above each category threshold', () => {
    expect(passesThreshold('aiGenerated', 50)).toBe(true);
    expect(passesThreshold('violent', 65)).toBe(true);
    expect(passesThreshold('explicit', 75)).toBe(true);
    expect(passesThreshold('aiGenerated', 100)).toBe(true);
  });

  it('fails below the threshold', () => {
    expect(passesThreshold('aiGenerated', 49)).toBe(false);
    expect(passesThreshold('violent', 64)).toBe(false);
    expect(passesThreshold('explicit', 74)).toBe(false);
  });

  it('uses the exact configured thresholds', () => {
    expect(DETECTION_THRESHOLDS).toEqual({ aiGenerated: 50, violent: 65, explicit: 75 });
  });
});
