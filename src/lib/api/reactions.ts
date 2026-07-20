import { postWithAuth } from './client';

export interface CreateReactionInput {
  activityId: string;
  taskId: string;
  /** true = "marked correct", false = "marked incorrect". */
  isPositive: boolean;
  /** The selected "expected result" reaction key, if the user picked one. */
  keyValue?: number | null;
  /** Optional free-text feedback. */
  description?: string | null;
}

/**
 * Submits a feedback reaction for one task's verification result.
 * Note: the backend allows only one reaction per activity+task.
 */
export function createReaction(token: string, input: CreateReactionInput): Promise<unknown> {
  return postWithAuth('/api/v1/reactions/', token, {
    activity_id: input.activityId,
    task_id: input.taskId,
    is_positive: input.isPositive,
    key_value: input.keyValue ?? null,
    description: input.description ?? null,
  });
}
