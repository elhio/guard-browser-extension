import { fetchWithAuth, postWithAuth } from './client';

/** Media MIME types the backend accepts */
export type MediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  | 'image/heic'
  | 'video/mp4'
  | 'video/webm'
  | 'video/quicktime';

const SUPPORTED_MEDIA_TYPES: readonly MediaType[] = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
  'video/mp4', 'video/webm', 'video/quicktime',
];

/** Lifecycle status of an activity */
export type ActivityStatus = 'pending_upload' | 'processing' | 'completed' | 'failed' | 'canceled';

/** S3 presigned POST descriptor returned when an activity is created. */
export interface PresignedUploadData {
  url: string;
  fields: Record<string, string>;
}

/** Response of `POST /activities/` — the created activity plus its upload target. */
export interface ActivityCreateResponse {
  id: string;
  status: ActivityStatus;
  upload_data: PresignedUploadData;
}

/** Response of `GET /activities/{id}/status`. */
export interface ActivityStatusResponse {
  id: string;
  status: ActivityStatus;
}

/** A single scored result item (label/description already resolved to the request locale). */
export interface ActivityResultItemPublic {
  task_id: string;
  score: number;
  label: string;
  description?: string | null;
  media_url?: string | null;
}

/** The result payload of a completed activity. */
export interface ActivityResultPublic {
  results: ActivityResultItemPublic[];
}

/** Response of `GET /activities/{id}` — includes the result once completed. */
export interface ActivityDetailPublic {
  id: string;
  status: ActivityStatus;
  result_payload?: ActivityResultPublic | null;
}

export interface CreateActivityInput {
  spaceId: string;
  userId: string;
  mediaType: MediaType;
  mediaSize: number;
}

/** Creates an activity for the given space/user and returns its presigned upload target. */
export function createActivity(token: string, input: CreateActivityInput): Promise<ActivityCreateResponse> {
  return postWithAuth<ActivityCreateResponse>('/api/v1/activities/', token, {
    space_id: input.spaceId,
    user_id: input.userId,
    media_type: input.mediaType,
    media_size: input.mediaSize,
  });
}

/** Uploads the media bytes to the S3 presigned POST target. */
export async function uploadMedia(presigned: PresignedUploadData, blob: Blob): Promise<void> {
  const form = new FormData();
  // The presigned policy fields (including Content-Type) must come first; the file last.
  for (const [key, value] of Object.entries(presigned.fields)) {
    form.append(key, value);
  }
  form.append('file', blob);

  const response = await fetch(presigned.url, { method: 'POST', body: form });
  if (!response.ok) {
    throw new Error(`Media upload failed: ${response.status} ${response.statusText}`);
  }
}

/** Confirms that the media was uploaded, moving the activity into processing. */
export function confirmUpload(token: string, activityId: string): Promise<unknown> {
  return postWithAuth(`/api/v1/activities/${activityId}/confirm`, token);
}

/** Reads the lightweight status of an activity. */
export function getActivityStatus(token: string, activityId: string): Promise<ActivityStatusResponse> {
  return fetchWithAuth<ActivityStatusResponse>(`/api/v1/activities/${activityId}/status`, token);
}

/** Reads the full activity, including its `result_payload` once completed. */
export function getActivity(token: string, activityId: string): Promise<ActivityDetailPublic> {
  return fetchWithAuth<ActivityDetailPublic>(`/api/v1/activities/${activityId}`, token);
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90_000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls an activity's status until it completes, or throws on failure/timeout. */
async function pollActivityUntilDone(token: string, activityId: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { status } = await getActivityStatus(token, activityId);
    if (status === 'completed') return;
    if (status === 'failed' || status === 'canceled') {
      throw new Error(`Verification ${status}`);
    }
    await delay(POLL_INTERVAL_MS);
  }

  throw new Error('timeout');
}

export interface RunImageVerificationInput {
  spaceId: string;
  userId: string;
  blob: Blob;
}

export interface ImageVerificationResult {
  activityId: string;
  results: ActivityResultItemPublic[];
}

/**
 * Runs the full external verification lifecycle for one image:
 * create activity → upload media → confirm → poll until done → fetch the result.
 *
 * @throws {Error} on an unsupported media type, any API error, or a failed/timed-out activity
 */
export async function runImageVerification(
  token: string,
  { spaceId, userId, blob }: RunImageVerificationInput
): Promise<ImageVerificationResult> {
  const mediaType = blob.type as MediaType;
  if (!SUPPORTED_MEDIA_TYPES.includes(mediaType)) {
    throw new Error('unsupported-media');
  }

  const activity = await createActivity(token, {
    spaceId,
    userId,
    mediaType,
    mediaSize: blob.size,
  });

  await uploadMedia(activity.upload_data, blob);
  await confirmUpload(token, activity.id);
  await pollActivityUntilDone(token, activity.id);

  const detail = await getActivity(token, activity.id);
  if (!detail.result_payload) {
    throw new Error('No verification result available');
  }
  return { activityId: activity.id, results: detail.result_payload.results };
}

/** Descriptor of a created share link (only the fields the extension uses). */
export interface ActivitySharePublic {
  id: string;
  share_url: string;
  expired_at: string;
  task_name: string;
}

export interface CreateActivityShareInput {
  activityId: string;
  taskId: string;
  /** Days the link stays valid (1-7). */
  expiresIn: number;
}

/** Creates a shareable link for one task's result of an activity. */
export function createActivityShare(
  token: string,
  input: CreateActivityShareInput
): Promise<ActivitySharePublic> {
  return postWithAuth<ActivitySharePublic>('/api/v1/activities/shares/', token, {
    activity_id: input.activityId,
    task_id: input.taskId,
    expires_in: input.expiresIn,
  });
}
