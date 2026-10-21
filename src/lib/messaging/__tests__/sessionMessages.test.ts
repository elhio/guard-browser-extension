import { describe, it, expect } from 'vitest';

import { isEndSessionRequest, isTokenReceived } from '../sessionMessages';

describe('isTokenReceived', () => {
  it('takes a whole handed-over session', () => {
    expect(
      isTokenReceived({ type: 'TOKEN_RECEIVED', token: 't', expiresIn: 600, refreshToken: 'rt_x' })
    ).toBe(true);
  });

  // What the website posted before 0.0.4, and an already signed-in page still would without a
  // session of its own: storing it would sign the user out within minutes
  it('ignores an access token alone', () => {
    expect(isTokenReceived({ type: 'TOKEN_RECEIVED', token: 't' })).toBe(false);
  });

  it('ignores other messages', () => {
    expect(
      isTokenReceived({ type: 'OPEN_TAB', token: 't', expiresIn: 600, refreshToken: 'rt_x' })
    ).toBe(false);
    expect(isTokenReceived(null)).toBe(false);
  });
});

describe('isEndSessionRequest', () => {
  it('recognises the relayed logout', () => {
    expect(isEndSessionRequest({ type: 'END_SESSION' })).toBe(true);
    expect(isEndSessionRequest({ type: 'TOKEN_RECEIVED' })).toBe(false);
  });
});
