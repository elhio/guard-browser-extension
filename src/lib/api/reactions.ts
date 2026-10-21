import { postWithAuth } from './client';

export interface CreateReactionInput {
  predictionId: string;
  targetId: string;
  /** true = "marked correct", false = "marked incorrect". */
  isPositive: boolean;
  /** The selected "expected result" reaction key, if the user picked one. */
  keyValue?: number | null;
  /** Optional free-text feedback. */
  description?: string | null;
}

/**
 * Submits a feedback reaction for one target's verification result.
 * Note: the backend allows only one reaction per prediction+target.
 */
export function createReaction(input: CreateReactionInput): Promise<unknown> {
  return postWithAuth('/api/v1/reactions', {
    prediction_id: input.predictionId,
    target_id: input.targetId,
    is_positive: input.isPositive,
    key_value: input.keyValue ?? null,
    description: input.description ?? null,
  });
}
