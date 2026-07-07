import { env, pipeline } from '@huggingface/transformers';
import { DEFAULT_MODEL } from './model';

declare const chrome: { runtime: { getURL: (path: string) => string } };

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
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: HTTP ${response.status}`);
  }

  const blobUrl = URL.createObjectURL(await response.blob());

  try {
    const classify = await getClassifier();
    // Retrieve the top 5 most confident labels to ensure we catch our regex matches
    const results = await classify(blobUrl, { top_k: 5 });
    return toAiScore(results);
  } finally {
    // Always clean up the object URL to prevent memory leaks in the extension background
    URL.revokeObjectURL(blobUrl);
  }
}