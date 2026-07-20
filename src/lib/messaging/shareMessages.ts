import { browser } from 'wxt/browser';

/** Routing id for creating a shareable result link (handled in the background). */
export const CREATE_SHARE_MESSAGE = 'CREATE_SHARE';

export interface CreateShareRequest {
  type: typeof CREATE_SHARE_MESSAGE;
  activityId: string;
  taskId: string;
  /** Days the link stays valid (1-7). */
  expiresIn: number;
}

/** Type guard for {@link CreateShareRequest}. */
export function isCreateShareRequest(message: unknown): message is CreateShareRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === CREATE_SHARE_MESSAGE &&
    typeof (message as Record<string, unknown>).activityId === 'string'
  );
}

export type CreateShareResponse =
  | { success: true; shareUrl: string }
  | { success: false; error: string };

/** Asks the background to create a share link and resolves with its URL (or an error). */
export async function requestShare(payload: {
  activityId: string;
  taskId: string;
  expiresIn: number;
}): Promise<CreateShareResponse> {
  return (await browser.runtime.sendMessage({
    type: CREATE_SHARE_MESSAGE,
    activityId: payload.activityId,
    taskId: payload.taskId,
    expiresIn: payload.expiresIn,
  } satisfies CreateShareRequest)) as CreateShareResponse;
}
