import { QueryClient } from '@tanstack/react-query';

import { isSessionRejected } from '@/lib/api/accounts';

/**
 * Creates the react-query client used by the extension's React entrypoints
 * (options page and setup wizard), keeping their query configuration in one place.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        // One retry for anything that might succeed on a second attempt. A refused session is not
        // one of those: the API rejects the same token the same way every time, so retrying only
        // holds the signed-out state behind the backoff
        retry: (failureCount, error) => !isSessionRejected(error) && failureCount < 1,
      },
    },
  });
}
