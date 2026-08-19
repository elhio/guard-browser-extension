import { getAppLocale, t } from '@/lib/i18n';
import { clearSession } from '@/lib/settings/store';

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  params?: Record<string, string>;
}

/**
 * Extracts a human-readable error message from a failed API response, preferring
 * FastAPI's `{ detail }` payload so messages like "File exceeds the limit" surface.
 */
async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    const detail = (data as { detail?: unknown })?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
  } catch {
    // no / non-JSON body
  }
  return `API Error: ${response.status} ${response.statusText}`;
}

/**
 * Makes an authenticated request to the application's external API, attaching the
 * bearer token and the current UI locale (`lang`) to every call.
 *
 * @template T - The expected type of the parsed JSON response (`undefined` for 204)
 * @throws {Error} If the network request fails or the server returns a non-2xx status
 *   (the server's `detail` message is used when present). A 401 additionally clears the stored
 *   session, since the token can never recover.
 */
async function request<T>(endpoint: string, token: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params = {} } = options;
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const locale = getAppLocale();

  const url = new URL(`${baseUrl}${endpoint}`);
  url.searchParams.append('lang', locale);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    await clearSession();
    throw new Error(t('auth_error_session_expired'));
  }

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

/**
 * Authenticated HTTP GET request. See {@link request}.
 *
 * @param endpoint - The relative API route (e.g., '/api/v1/users/me')
 * @param token - A valid bearer token
 * @param params - Optional query parameters
 */
export async function fetchWithAuth<T>(
  endpoint: string,
  token: string,
  params: Record<string, string> = {}
): Promise<T> {
  return request<T>(endpoint, token, { params });
}

/**
 * Authenticated HTTP POST request with an optional JSON body. See {@link request}.
 *
 * @param endpoint - The relative API route (e.g., '/api/v1/activities/')
 * @param token - A valid bearer token
 * @param body - Optional payload serialized as JSON
 * @param params - Optional query parameters
 */
export async function postWithAuth<T>(
  endpoint: string,
  token: string,
  body?: unknown,
  params: Record<string, string> = {}
): Promise<T> {
  return request<T>(endpoint, token, { method: 'POST', body, params });
}
