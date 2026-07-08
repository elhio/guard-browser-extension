/**
 * `fetch` with a hard timeout. Aborts the request after `timeoutMs` so a hung or
 * unresponsive server can't stall image classification indefinitely.
 *
 * @param url - The resource to fetch
 * @param timeoutMs - Abort the request after this many milliseconds
 * @param init - Optional fetch init (its `signal`, if any, is respected alongside the timeout)
 * @returns The `Response` (rejects with an `AbortError` on timeout, like a normal abort)
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
