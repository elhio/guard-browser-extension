import type { AiDetectionResult, AiSignalMatch } from './types';

/** The matched signals that point at the image being a genuine real-world capture. */
export function getAuthenticityMatches(result: AiDetectionResult): AiSignalMatch[] {
  return result.matches.filter((match) => match.kind === 'authenticity');
}

/** Whether the metadata contains positive evidence that the image is a real capture. */
export function hasAuthenticityEvidence(result: AiDetectionResult): boolean {
  return getAuthenticityMatches(result).length > 0;
}
