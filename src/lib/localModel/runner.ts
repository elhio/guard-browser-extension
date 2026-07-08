import { env, pipeline } from '@huggingface/transformers';
import { DEFAULT_MODEL } from './model';
import { fetchWithTimeout } from '@/lib/net/fetchWithTimeout';

declare const chrome: { runtime: { getURL: (path: string) => string } };

/** How long to wait for the model's image download before treating it as failed. */
const MODEL_FETCH_TIMEOUT_MS = 10_000;

/**
 * Environment configuration for transformers.js within a Chrome Extension (Manifest V3).
 * Extension pages cannot pull WASM binaries from a CDN due to strict Content Security Policies (CSP).
 * This points the bundled onnxruntime-web at the local WASM binaries shipped in the `/wasm` directory,
 * which are exposed via `web_accessible_resources`.
 */
env.allowLocalModels = false;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('/wasm/');
  // Optimize thread count based on hardware, capped at 4 to prevent UI freezing
  env.backends.onnx.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);
}

/**
 * Represents a single prediction returned by the Hugging Face classification pipeline
 *
 * @property label - The string label assigned by the model (e.g., 'fake', 'real')
 * @property score - The confidence score of the prediction, ranging from 0.0 to 1.0
 */
interface ClassificationResult {
  label: string;
  score: number;
}

/**
 * * Lazily created singleton promise
 */
let pipelinePromise: Promise<(input: string, options?: unknown) => Promise<ClassificationResult[]>> | undefined;

/**
 * Retrieves the active image classification pipeline, initializing it if it does not yet exist
 *
 * @returns A promise resolving to the transformers.js pipeline execution function
 */
function getClassifier() {
  if (!pipelinePromise) {
    pipelinePromise = pipeline('image-classification', DEFAULT_MODEL.repo) as Promise<
      (input: string, options?: unknown) => Promise<ClassificationResult[]>
    >;
  }
  return pipelinePromise;
}

/**
 * Serializes access to the single shared model. onnxruntime-web cannot run multiple
 * inferences concurrently on one session, so queued calls execute one-at-a-time on the
 * single `getClassifier()` pipeline instead of overlapping.
 */
let inferenceChain: Promise<unknown> = Promise.resolve();
function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const result = inferenceChain.then(task, task);
  // Keep the chain alive regardless of this task's outcome.
  inferenceChain = result.catch(() => {});
  return result;
}

const AI_LABEL = /fake|artificial|generated|synthetic|\bai\b/i;
const REAL_LABEL = /real|human|authentic|natural|photo/i;

/**
 * * Maps the raw label/score list returned by the model to a single normalized "probability this is AI"
 *
 * @param results - The array of top classifications returned by the model
 * @returns A float between 0.0 and 1.0 representing AI likelihood, or null if the output couldn't be mapped safely
 */
function toAiScore(results: ClassificationResult[]): number | null {
  for (const result of results) {
    if (AI_LABEL.test(result.label)) return result.score;
  }
  for (const result of results) {
    if (REAL_LABEL.test(result.label)) return 1 - result.score;
  }
  return null;
}

/**
 * Runs the local ONNX vision model on the specified image and returns the probability
 * that it is AI-generated
 *
 * The image is fetched into a local Blob URL first. This is identical to the C2PA reader
 * approach, ensuring cross-origin loading behaves consistently and avoids HTML Canvas
 * tainting issues that would otherwise block pixel extraction.
 *
 * @param src - The absolute URL of the image to classify
 * @returns A promise resolving to a float between 0.0 and 1.0, or null if unmappable
 * @throws {Error} If the image network fetch fails prior to classification
 */
export async function classifyImageAiScore(src: string): Promise<number | null> {
  const response = await fetchWithTimeout(src, MODEL_FETCH_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: HTTP ${response.status}`);
  }

  const blobUrl = URL.createObjectURL(await response.blob());

  try {
    const classify = await getClassifier();
    // Retrieve the top 5 most confident labels to ensure we catch our regex matches.
    // Inference is serialized so concurrent images share the one model without overlapping.
    const results = await runSerialized(() => classify(blobUrl, { top_k: 5 }));
    return toAiScore(results);
  } finally {
    // Always clean up the object URL to prevent memory leaks in the extension background
    URL.revokeObjectURL(blobUrl);
  }
}