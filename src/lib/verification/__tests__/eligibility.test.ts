import { describe, it, expect } from 'vitest';

import { categoryForTargetName, checkSpaceEligibility } from '../eligibility';
import type { SpacePublic } from '@/lib/api';
import type { TargetsState } from '@/lib/detection';

/** Builds a full SpacePublic with sensible defaults; override only what a test cares about. */
function makeSpace(overrides: Partial<SpacePublic> = {}): SpacePublic {
  return {
    id: 'space-1',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    name: 'Test Space',
    description: null,
    slug: 'test-space',
    url_id: 'abc',
    is_default: false,
    is_public: true,
    user_id: null,
    user_name: null,
    organization_id: null,
    organization_name: null,
    predictor_id: 'pred-1',
    predictor_name: 'Test Model',
    enabled_media: ['image'],
    enabled_target_names: ['AI-Generated', 'Violent', 'Explicit'],
    ...overrides,
  };
}

const allTargets: TargetsState = { aiGenerated: true, violent: true, explicit: true };

describe('categoryForTargetName', () => {
  it('maps English target labels to categories', () => {
    expect(categoryForTargetName('AI-Generated')).toBe('aiGenerated');
    expect(categoryForTargetName('Violent')).toBe('violent');
    expect(categoryForTargetName('Explicit')).toBe('explicit');
  });

  it('maps German target labels to categories', () => {
    expect(categoryForTargetName('Gewalttätig')).toBe('violent');
    expect(categoryForTargetName('Explizit')).toBe('explicit');
  });

  it('is trim- and case-insensitive', () => {
    expect(categoryForTargetName('  ai-generated  ')).toBe('aiGenerated');
  });

  it('returns null for an unknown label', () => {
    expect(categoryForTargetName('Deepfake')).toBeNull();
  });
});

describe('checkSpaceEligibility', () => {
  it('is eligible when the space supports image media and every enabled target', () => {
    expect(checkSpaceEligibility(makeSpace(), allTargets)).toEqual({ eligible: true });
  });

  it('is ineligible with reason "media" when images are not supported', () => {
    const space = makeSpace({ enabled_media: ['video'] });
    expect(checkSpaceEligibility(space, allTargets)).toEqual({ eligible: false, reason: 'media' });
  });

  it('is ineligible with the category as the reason when an enabled target is not covered', () => {
    const space = makeSpace({ enabled_target_names: ['AI-Generated', 'Explicit'] });
    expect(checkSpaceEligibility(space, allTargets)).toEqual({ eligible: false, reason: 'violent' });
  });

  it('ignores targets the user has disabled', () => {
    const space = makeSpace({ enabled_target_names: ['AI-Generated'] });
    const targets: TargetsState = { aiGenerated: true, violent: false, explicit: false };
    expect(checkSpaceEligibility(space, targets)).toEqual({ eligible: true });
  });
});
