import { browser } from 'wxt/browser';

/** Routing id for submitting a feedback reaction (handled in the background). */
export const SUBMIT_REACTION_MESSAGE = 'SUBMIT_REACTION';

export interface SubmitReactionRequest {
  type: typeof SUBMIT_REACTION_MESSAGE;
  predictionId: string;
  targetId: string;
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
    typeof (message as Record<string, unknown>).predictionId === 'string'
  );
}

export interface SubmitReactionPayload {
  predictionId: string;
  targetId: string;
  isPositive: boolean;
  keyValue?: number | null;
  description?: string | null;
}

/** Fire-and-forget: ask the background to submit a feedback reaction. */
export function submitReaction(payload: SubmitReactionPayload): void {
  void browser.runtime.sendMessage({
    type: SUBMIT_REACTION_MESSAGE,
    predictionId: payload.predictionId,
    targetId: payload.targetId,
    isPositive: payload.isPositive,
    keyValue: payload.keyValue ?? null,
    description: payload.description ?? null,
  } satisfies SubmitReactionRequest);
}
