import { QueryClient } from '@tanstack/react-query';

/**
 * Creates the react-query client used by the extension's React entrypoints
 * (options page and setup wizard), keeping their query configuration in one place.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
