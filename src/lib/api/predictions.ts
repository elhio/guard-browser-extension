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

/** Lifecycle status of a prediction */
export type PredictionStatus = 'pending_upload' | 'processing' | 'completed' | 'failed' | 'canceled';

/** S3 presigned POST descriptor returned when a prediction is created. */
export interface PresignedUploadData {
  url: string;
  fields: Record<string, string>;
}

/** Response of `POST /predictions/` — the created prediction plus its upload target. */
export interface PredictionCreateResponse {
  id: string;
  status: PredictionStatus;
  upload_data: PresignedUploadData;
}

/** Response of `GET /predictions/{id}/status`. */
export interface PredictionStatusResponse {
  id: string;
  status: PredictionStatus;
}

/** A single scored result item (label/description already resolved to the request locale). */
export interface PredictionResultItemPublic {
  target_id: string;
  score: number;
  label: string;
  description?: string | null;
  media_url?: string | null;
}

/** The result payload of a completed prediction. */
export interface PredictionResultPublic {
  results: PredictionResultItemPublic[];
}

/** Response of `GET /predictions/{id}` — includes the result once completed. */
export interface PredictionDetailPublic {
  id: string;
  status: PredictionStatus;
  result_payload?: PredictionResultPublic | null;
}

export interface CreatePredictionInput {
  spaceId: string;
  userId: string;
  mediaType: MediaType;
  mediaSize: number;
  /**
   * The image's dimensions, when they could be read. The API reserves tokens from them, and refuses
   * an image whose long side has no price (413) before anything is uploaded
   */
  width?: number;
  height?: number;
}

/** Creates a prediction for the given space/user and returns its presigned upload target. */
export function createPrediction(input: CreatePredictionInput): Promise<PredictionCreateResponse> {
  return postWithAuth<PredictionCreateResponse>('/api/v1/predictions', {
    space_id: input.spaceId,
    user_id: input.userId,
    media_type: input.mediaType,
    media_size: input.mediaSize,
    ...(input.width && input.height ? { width: input.width, height: input.height } : {}),
  });
}

/**
 * Reads an image's dimensions without drawing it, or `undefined` when it can't be decoded here
 * (an HEIC image, for one), in which case the prediction is created without them.
 */
export async function readImageDimensions(
  blob: Blob
): Promise<{ width: number; height: number } | undefined> {
  if (typeof createImageBitmap !== 'function') return undefined;
  try {
    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions.width > 0 && dimensions.height > 0 ? dimensions : undefined;
  } catch {
    return undefined;
  }
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

/** Confirms that the media was uploaded, moving the prediction into processing. */
export function confirmUpload(predictionId: string): Promise<unknown> {
  return postWithAuth(`/api/v1/predictions/${predictionId}/confirm`);
}

/** Reads the lightweight status of a prediction. */
export function getPredictionStatus(predictionId: string): Promise<PredictionStatusResponse> {
  return fetchWithAuth<PredictionStatusResponse>(`/api/v1/predictions/${predictionId}/status`);
}

/** Reads the full prediction, including its `result_payload` once completed. */
export function getPrediction(predictionId: string): Promise<PredictionDetailPublic> {
  return fetchWithAuth<PredictionDetailPublic>(`/api/v1/predictions/${predictionId}`);
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90_000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls a prediction's status until it completes, or throws on failure/timeout. */
async function pollPredictionUntilDone(predictionId: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { status } = await getPredictionStatus(predictionId);
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
  predictionId: string;
  results: PredictionResultItemPublic[];
}

/**
 * Runs the full external verification lifecycle for one image:
 * create prediction → upload media → confirm → poll until done → fetch the result.
 *
 * @throws {Error} on an unsupported media type, any API error (an {@link ApiError} 413 for an image
 *   too large to verify), or a failed/timed-out prediction
 */
export async function runImageVerification(
  { spaceId, userId, blob }: RunImageVerificationInput
): Promise<ImageVerificationResult> {
  const mediaType = blob.type as MediaType;
  if (!SUPPORTED_MEDIA_TYPES.includes(mediaType)) {
    throw new Error('unsupported-media');
  }

  const prediction = await createPrediction({
    spaceId,
    userId,
    mediaType,
    mediaSize: blob.size,
    ...(await readImageDimensions(blob)),
  });

  await uploadMedia(prediction.upload_data, blob);
  await confirmUpload(prediction.id);
  await pollPredictionUntilDone(prediction.id);

  const detail = await getPrediction(prediction.id);
  if (!detail.result_payload) {
    throw new Error('No verification result available');
  }
  return { predictionId: prediction.id, results: detail.result_payload.results };
}

/** Descriptor of a created share link (only the fields the extension uses). */
export interface PredictionSharePublic {
  id: string;
  share_url: string;
  expired_at: string;
  target_name: string;
}

export interface CreatePredictionShareInput {
  predictionId: string;
  targetId: string;
  /** Days the link stays valid (1-7). */
  expiresIn: number;
}

/** Creates a shareable link for one target's result of a prediction. */
export function createPredictionShare(
  input: CreatePredictionShareInput
): Promise<PredictionSharePublic> {
  return postWithAuth<PredictionSharePublic>('/api/v1/predictions/shares', {
    prediction_id: input.predictionId,
    target_id: input.targetId,
    expires_in: input.expiresIn,
  });
}
