import { describe, it, expect } from 'vitest';

import { isTokenExpired } from '../token';

/**
 * Builds a token shaped like the one the API issues: three dot-separated segments, the middle one a
 * base64url payload. The signature is never read, so a placeholder is enough.
 */
function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const nowInSeconds = () => Math.floor(Date.now() / 1000);

describe('isTokenExpired', () => {
  it('reports a token whose deadline has passed', () => {
    expect(isTokenExpired(jwt({ sub: 'u1', exp: nowInSeconds() - 60 * 60 }))).toBe(true);
  });

  it('reports a token that is still good', () => {
    expect(isTokenExpired(jwt({ sub: 'u1', exp: nowInSeconds() + 60 * 60 * 24 }))).toBe(false);
  });

  // A clock running slightly fast must not end a session the API would still accept.
  it('tolerates a deadline that has only just passed', () => {
    expect(isTokenExpired(jwt({ sub: 'u1', exp: nowInSeconds() - 10 }))).toBe(false);
  });

  it('honours a caller supplied skew', () => {
    expect(isTokenExpired(jwt({ sub: 'u1', exp: nowInSeconds() - 10 }), 0)).toBe(true);
  });

  // Everything below is a token this function cannot read. The API stays the authority on those, so
  // the safe answer is "not expired" — discarding a credential we failed to parse would sign the
  // user out over our own bug.
  it.each([
    ['a service token', 'sk_live_abcdef'],
    ['an opaque string', 'not-a-jwt'],
    ['too few segments', 'aGVhZGVy.cGF5bG9hZA'],
    ['a payload that is not base64', 'aGVhZGVy.!!!.signature'],
    ['a payload that is not JSON', `${btoa('header')}.${btoa('plain text')}.signature`],
  ])('treats %s as not expired', (_label, token) => {
    expect(isTokenExpired(token)).toBe(false);
  });

  it.each([
    ['no exp claim', { sub: 'u1' }],
    ['a non-numeric exp', { sub: 'u1', exp: 'soon' }],
  ])('treats a JWT with %s as not expired', (_label, payload) => {
    expect(isTokenExpired(jwt(payload))).toBe(false);
  });
});
