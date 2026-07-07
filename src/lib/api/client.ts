import { getAppLocale } from '@/lib/i18n';

/**
 * Makes an authenticated HTTP GET request to the application's external API
 *
 * @template T - The expected type/interface of the parsed JSON response payload
 * @param endpoint - The relative API route to fetch (e.g., '/api/v1/users/me')
 * @param token - A valid bearer token used to authenticate the request
 * @param params - An optional dictionary of query parameters to append to the request
 * @returns A promise that resolves to the parsed JSON payload cast to type `T`
 * @throws {Error} If the network request fails or the server returns a non-2xx HTTP status code
 */
export async function fetchWithAuth<T>(
  endpoint: string,
  token: string,
  params: Record<string, string> = {}
): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const locale = getAppLocale();

  const url = new URL(`${baseUrl}${endpoint}`);

  url.searchParams.append('lang', locale);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}