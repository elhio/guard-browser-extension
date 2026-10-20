/**
 * An error carrying the HTTP status that produced it.
 *
 * Some endpoints answer a perfectly ordinary state with a non-2xx status — `/users/me/subscription`
 * returns 404 for anyone on the free plan — so a caller has to be able to tell that apart from a
 * genuine failure. Callers that only care about the message can keep catching `Error`.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
