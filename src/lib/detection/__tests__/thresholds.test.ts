import { describe, it, expect } from 'vitest';

import { passesThreshold, DETECTION_THRESHOLDS } from '../thresholds';

describe('passesThreshold', () => {
  it('passes at or above each category threshold', () => {
    expect(passesThreshold('aiGenerated', 90)).toBe(true);
    expect(passesThreshold('violent', 70)).toBe(true);
    expect(passesThreshold('explicit', 70)).toBe(true);
    expect(passesThreshold('aiGenerated', 100)).toBe(true);
  });

  it('fails below the threshold', () => {
    expect(passesThreshold('aiGenerated', 89)).toBe(false);
    expect(passesThreshold('violent', 69)).toBe(false);
    expect(passesThreshold('explicit', 69)).toBe(false);
  });

  it('uses the exact configured thresholds', () => {
    expect(DETECTION_THRESHOLDS).toEqual({ aiGenerated: 90, violent: 70, explicit: 70 });
  });
});
