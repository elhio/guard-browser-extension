import { describe, it, expect } from 'vitest';

import { APP_SYNC_MESSAGE, createCheckGate, isAppSyncRequest } from '../appSync';

describe('createCheckGate', () => {
  it('lets one check through per interval', () => {
    let now = 0;
    const gate = createCheckGate(1000, () => now);
    expect(gate.tryPass()).toBe(true);
    now = 500;
    expect(gate.tryPass()).toBe(false);
    now = 1000;
    expect(gate.tryPass()).toBe(true);
  });

  it('counts a full report as a check', () => {
    let now = 0;
    const gate = createCheckGate(1000, () => now);
    gate.mark();
    now = 999;
    expect(gate.tryPass()).toBe(false);
  });
});

describe('isAppSyncRequest', () => {
  it('recognises the message', () => {
    expect(isAppSyncRequest({ type: APP_SYNC_MESSAGE })).toBe(true);
    expect(isAppSyncRequest({ type: 'APP_HANDOFF' })).toBe(false);
    expect(isAppSyncRequest(null)).toBe(false);
  });
});
