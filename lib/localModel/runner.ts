import { env, pipeline } from '@huggingface/transformers';
import { DEFAULT_MODEL } from './model';

declare const chrome: { runtime: { getURL: (path: string) => string } };

// Point transformers.js' bundled onnxruntime-web at the WASM binaries we ship
// in /wasm (extension pages can't pull them from a CDN under the MV3 CSP).
// These files live in public/wasm and are exposed via web_accessible_resources.
env.allowLocalModels = false;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('/wasm/');
  env.backends.onnx.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);
}

interface ClassificationResult {
  label: string;
  score: number;
}

// Lazily created once, then reused — loading the model weights is expensive.
let pipelinePromise: Promise<(input: string, options?: unknown) => Promise<ClassificationResult[]>> | undefined;

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

/** Maps the model's label/score list to a single "probability this is AI" in [0,1], or null if unclear. */
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
 * Runs the local model on the image at `src` and returns the probability that
 * it is AI-generated (0-1), or null if the model's output couldn't be mapped.
 *
 * The image is fetched into a blob URL first (same approach as the C2PA reader)
 * so cross-origin loading behaves consistently and avoids tainting issues.
 */
export async function classifyImageAiScore(src: string): Promise<number | null> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: HTTP ${response.status}`);
  }
  const blobUrl = URL.createObjectURL(await response.blob());
  try {
    const classify = await getClassifier();
    const results = await classify(blobUrl, { top_k: 5 });
    return toAiScore(results);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
