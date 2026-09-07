/**
 * The clock difference tolerated before a token is called expired.
 *
 * The check below runs on the user's machine against a deadline set on the server, so a device clock
 * running fast would otherwise sign someone out of a session the API would still have accepted. A
 * minute is far shorter than the eight day token lifetime, so nothing is meaningfully prolonged.
 */
const CLOCK_SKEW_SECONDS = 60;

/**
 * Reads the `exp` claim out of a JWT without verifying it.
 *
 * Verification is the server's job and needs a secret the extension does not have. That is fine: the
 * claim is only ever used to skip a request that is already known to fail, never to grant access. A
 * forged token buys nothing, because every call is still checked at the other end.
 *
 * @param token - The stored bearer token
 * @returns The expiry as seconds since the epoch, or `undefined` if this is not a JWT carrying one
 */
function readExpiry(token: string): number | undefined {
  const segments = token.split('.');
  if (segments.length !== 3) return undefined;

  try {
    // JWTs use base64url, which swaps two characters of the alphabet and drops the padding `atob`
    // still expects.
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));

    const exp = (payload as { exp?: unknown })?.exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : undefined;
  } catch {
    // Not base64, not JSON, or not an object. Either way there is no deadline to read.
    return undefined;
  }
}

/**
 * Whether a stored token has passed its own expiry.
 *
 * The extension used to learn this only from the API, which meant a page had to render something
 * before the answer came back, and an offline user was never told at all. Checking the deadline the
 * token carries lets the settings page show the signed-out state on the first frame and get it right
 * with no network.
 *
 * Anything unreadable answers `false` on purpose. The API remains the authority on whether a
 * credential works; this only short-circuits the one case it can prove on its own. That default also
 * covers the `sk_` prefixed service tokens the backend accepts, which are not JWTs and carry no
 * expiry — the extension never holds one today, and if it ever does it must not be discarded here.
 *
 * @param token - The stored bearer token
 * @param skewSeconds - Clock difference to tolerate, defaulting to {@link CLOCK_SKEW_SECONDS}
 */
export function isTokenExpired(token: string, skewSeconds: number = CLOCK_SKEW_SECONDS): boolean {
  const expiresAt = readExpiry(token);
  if (expiresAt === undefined) return false;

  return Date.now() / 1000 > expiresAt + skewSeconds;
}
