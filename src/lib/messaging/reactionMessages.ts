import { browser } from 'wxt/browser';

/** Routing id for submitting a feedback reaction (handled in the background). */
export const SUBMIT_REACTION_MESSAGE = 'SUBMIT_REACTION';

export interface SubmitReactionRequest {
  type: typeof SUBMIT_REACTION_MESSAGE;
  activityId: string;
  taskId: string;
  isPositive: boolean;
  keyValue: number | null;
  description: string | null;
}

/** Type guard for {@link SubmitReactionRequest}. */
export function isSubmitReactionRequest(message: unknown): message is SubmitReactionRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === SUBMIT_REACTION_MESSAGE &&
    typeof (message as Record<string, unknown>).activityId === 'string'
  );
}

export interface SubmitReactionPayload {
  activityId: string;
  taskId: string;
  isPositive: boolean;
  keyValue?: number | null;
  description?: string | null;
}

/** Fire-and-forget: ask the background to submit a feedback reaction. */
export function submitReaction(payload: SubmitReactionPayload): void {
  void browser.runtime.sendMessage({
    type: SUBMIT_REACTION_MESSAGE,
    activityId: payload.activityId,
    taskId: payload.taskId,
    isPositive: payload.isPositive,
    keyValue: payload.keyValue ?? null,
    description: payload.description ?? null,
  } satisfies SubmitReactionRequest);
}
