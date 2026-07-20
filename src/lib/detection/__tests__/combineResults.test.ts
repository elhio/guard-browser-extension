import { describe, it, expect } from 'vitest';

import {
  bucketMatchesByCategory,
  combineCategoryResults,
  isImageFlagged,
} from '../combineResults';
import type { CategoryDetectionResult, DetectionCategory, DetectionSignalMatch } from '../types';

/** Minimal match factory; only `category` and `confidence` matter to these functions. */
function match(
  category: DetectionCategory,
  confidence: number,
  id = `${category}-${confidence}`
): DetectionSignalMatch {
  return {
    id,
    category,
    label: 'label',
    description: 'description',
    confidence,
    evidence: 'evidence',
  };
}

describe('bucketMatchesByCategory', () => {
  it('groups matches by category and only includes categories that matched', () => {
    const categories = bucketMatchesByCategory([match('aiGenerated', 30), match('violent', 70)]);
    expect(Object.keys(categories).sort()).toEqual(['aiGenerated', 'violent']);
    expect(categories.explicit).toBeUndefined();
  });

  it('sorts matches by confidence desc and takes the max as the bucket confidence', () => {
    const categories = bucketMatchesByCategory([
      match('aiGenerated', 20),
      match('aiGenerated', 80),
      match('aiGenerated', 55),
    ]);
    const bucket = categories.aiGenerated!;
    expect(bucket.matches.map((m) => m.confidence)).toEqual([80, 55, 20]);
    expect(bucket.confidence).toBe(80);
  });

  it('derives `detected` from the category threshold', () => {
    const categories = bucketMatchesByCategory([match('explicit', 80), match('violent', 60)]);
    expect(categories.explicit!.detected).toBe(true); // 80 >= 70
    expect(categories.violent!.detected).toBe(false); // 60 < 70
  });
});

describe('combineCategoryResults', () => {
  it('merges matches from several results, sorts them, and applies the threshold', () => {
    const a: CategoryDetectionResult = {
      detected: false,
      confidence: 90,
      matches: [match('aiGenerated', 90)],
    };
    const b: CategoryDetectionResult = {
      detected: false,
      confidence: 95,
      matches: [match('aiGenerated', 95)],
    };
    const combined = combineCategoryResults('aiGenerated', [a, b]);
    expect(combined.confidence).toBe(95);
    expect(combined.detected).toBe(true); // 95 >= 90
    expect(combined.matches.map((m) => m.confidence)).toEqual([95, 90]);
  });

  it('returns confidence 0 and not detected when there are no matches', () => {
    const combined = combineCategoryResults('violent', []);
    expect(combined).toEqual({ detected: false, confidence: 0, matches: [] });
  });
});

describe('isImageFlagged', () => {
  it('is true when any category is detected', () => {
    expect(
      isImageFlagged({
        aiGenerated: { detected: false, confidence: 10, matches: [] },
        violent: { detected: true, confidence: 90, matches: [] },
      })
    ).toBe(true);
  });

  it('is false when no category is detected', () => {
    expect(
      isImageFlagged({
        aiGenerated: { detected: false, confidence: 10, matches: [] },
      })
    ).toBe(false);
  });

  it('is false for an empty categories object', () => {
    expect(isImageFlagged({})).toBe(false);
  });
});
