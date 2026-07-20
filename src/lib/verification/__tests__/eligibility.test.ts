import { describe, it, expect } from 'vitest';

import { categoryForTaskLabel, checkSpaceEligibility } from '../eligibility';
import type { SpacePublic } from '@/lib/api';
import type { TasksState } from '@/lib/detection';

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
    enabled_task_names: ['AI-Generated', 'Violent', 'Explicit'],
    ...overrides,
  };
}

const allTasks: TasksState = { aiGenerated: true, violent: true, explicit: true };

describe('categoryForTaskLabel', () => {
  it('maps English task labels to categories', () => {
    expect(categoryForTaskLabel('AI-Generated')).toBe('aiGenerated');
    expect(categoryForTaskLabel('Violent')).toBe('violent');
    expect(categoryForTaskLabel('Explicit')).toBe('explicit');
  });

  it('maps German task labels to categories', () => {
    expect(categoryForTaskLabel('Gewalttätig')).toBe('violent');
    expect(categoryForTaskLabel('Explizit')).toBe('explicit');
  });

  it('is trim- and case-insensitive', () => {
    expect(categoryForTaskLabel('  ai-generated  ')).toBe('aiGenerated');
  });

  it('returns null for an unknown label', () => {
    expect(categoryForTaskLabel('Deepfake')).toBeNull();
  });
});

describe('checkSpaceEligibility', () => {
  it('is eligible when the space supports image media and every enabled task', () => {
    expect(checkSpaceEligibility(makeSpace(), allTasks)).toEqual({ eligible: true });
  });

  it('is ineligible with reason "media" when images are not supported', () => {
    const space = makeSpace({ enabled_media: ['video'] });
    expect(checkSpaceEligibility(space, allTasks)).toEqual({ eligible: false, reason: 'media' });
  });

  it('is ineligible with the category as the reason when an enabled task is not covered', () => {
    const space = makeSpace({ enabled_task_names: ['AI-Generated', 'Explicit'] });
    expect(checkSpaceEligibility(space, allTasks)).toEqual({ eligible: false, reason: 'violent' });
  });

  it('ignores tasks the user has disabled', () => {
    const space = makeSpace({ enabled_task_names: ['AI-Generated'] });
    const tasks: TasksState = { aiGenerated: true, violent: false, explicit: false };
    expect(checkSpaceEligibility(space, tasks)).toEqual({ eligible: true });
  });
});
