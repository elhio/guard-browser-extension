import { env, AutoModel, ImageProcessor, RawImage, Tensor } from '@huggingface/transformers';
import { LOCAL_MODEL } from './model';
import { fetchWithTimeout } from '@/lib/net/fetchWithTimeout';

declare const chrome: { runtime: { getURL: (path: string) => string } };

/** How long to wait for the source image download before treating it as failed. */
const MODEL_FETCH_TIMEOUT_MS = 10_000;

/**
 * Environment configuration for transformers.js inside a Chrome Extension (Manifest V3).
 * Extension pages cannot pull WASM binaries from a CDN due to the strict Content Security Policy,
 * so onnxruntime-web is pointed at the local binaries shipped in `/wasm` (exposed via
 * `web_accessible_resources`). The weights are packaged locally too, so remote model fetches are
 * disabled entirely.
 */
env.allowLocalModels = true;
env.allowRemoteModels = false;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('/wasm/');
  // Multi-threaded WASM requires SharedArrayBuffer, which needs cross-origin isolation that the
  // offscreen context doesn't have. Pin to a single thread so onnxruntime-web doesn't spin up a
  // thread pool it can't use (a failed fallback that wastes time without speeding inference up).
  env.backends.onnx.wasm.numThreads = 1;
}

/** Logs the inference environment once so slow-runtime issues can be diagnosed from the console. */
let loggedEnv = false;
function logEnvironmentOnce(): void {
  if (loggedEnv) return;
  loggedEnv = true;
  console.info('[Guard model] environment', {
    crossOriginIsolated:
      typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : 'unknown',
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    hardwareConcurrency: navigator.hardwareConcurrency
  });
}

/**
 * Normalized model output: the probability (0-1) for each detection category.
 */
export interface LocalModelScores {
  aiGenerated: number;
  violent: number;
  explicit: number;
}

/** The loaded model together with its preprocessing pipeline. */
interface LoadedModel {
  model: (inputs: Record<string, unknown>) => Promise<Record<string, { data: ArrayLike<number> }>>;
  processor: (image: RawImage) => Promise<{ pixel_values: unknown }>;
}

type ExecutionProvider = 'webgpu' | 'wasm';

/**
 * Lazily created singleton. The model is loaded and its ORT session created only once, then shared
 * across every image on the page.
 */
let modelPromise: Promise<LoadedModel> | undefined;

/** Whether the current context can use WebGPU at all. */
function isWebGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as Navigator & { gpu?: unknown }).gpu;
}

/**
 * The execution providers to try, in order, given the configured `device` preference and dtype.
 * WebGPU needs no cross-origin isolation (unlike threaded WASM) and is fast for ViTs, but its
 * kernels don't cover int8 dynamic quantization well — so `'auto'` only reaches for WebGPU with
 * float weights. WASM is always the last resort.
 */
function resolveProviders(): ExecutionProvider[] {
  const gpu = isWebGpuAvailable();
  switch (LOCAL_MODEL.device) {
    case 'wasm':
      return ['wasm'];
    case 'webgpu':
      return gpu ? ['webgpu', 'wasm'] : ['wasm'];
    case 'auto':
    default:
      return gpu && LOCAL_MODEL.dtype !== 'int8' ? ['webgpu', 'wasm'] : ['wasm'];
  }
}

/** Runs one dummy inference to prove a provider can actually execute this model end-to-end. */
async function warmUp(model: LoadedModel['model']): Promise<void> {
  const size = LOCAL_MODEL.imageSize;
  const input = new Tensor('float32', new Float32Array(3 * size * size), [1, 3, size, size]);
  await model({ input });
}

/**
 * Loads the model on the first provider that initializes, falling back to WASM. WebGPU sessions are
 * warmed up before being accepted, so we never commit to a provider that can't run this model
 * (e.g. missing kernels) — in that case the loop falls through to WASM.
 */
async function loadModelWithFallback(): Promise<{ model: LoadedModel['model']; device: ExecutionProvider }> {
  const providers = resolveProviders();
  let lastError: unknown;

  for (const device of providers) {
    try {
      const model = (await AutoModel.from_pretrained(chrome.runtime.getURL(LOCAL_MODEL.dir), {
        dtype: LOCAL_MODEL.dtype,
        device
      })) as unknown as LoadedModel['model'];

      // WASM always works; only validate WebGPU (its op coverage is model-dependent).
      if (device === 'webgpu') await warmUp(model);

      return { model, device };
    } catch (error) {
      lastError = error;
      console.warn(`[Guard model] execution provider "${device}" unavailable:`, error);
    }
  }

  throw lastError ?? new Error('No execution provider could load the local model');
}

/**
 * Loads the local ONNX model and builds the image processor.
 *
 * The model is loaded via `AutoModel`, whose `config.json` declares `model_type: "custom"`. Because
 * that architecture is unknown to transformers.js, it falls back to the base class whose forward
 * returns the raw ORT outputs keyed by the graph's output names (`out_ai`, `out_violence`,
 * `out_nsfw`). The image processor is constructed from a plain config object — no
 * `preprocessor_config.json` on disk — resizing the longest edge to 518, padding to a 518×518
 * square, then rescaling and normalizing with ImageNet statistics.
 */
function getModel(): Promise<LoadedModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const loadStart = performance.now();
      const { model, device } = await loadModelWithFallback();

      // `do_pad`/`pad_size` are honored by the base ImageProcessor at runtime but are missing from
      // its published config type, so the config is assembled separately and cast.
      const processorConfig = {
        do_resize: true,
        size: { longest_edge: LOCAL_MODEL.imageSize },
        do_pad: true,
        pad_size: { width: LOCAL_MODEL.imageSize, height: LOCAL_MODEL.imageSize },
        do_rescale: true,
        rescale_factor: 1 / 255,
        do_normalize: true,
        image_mean: LOCAL_MODEL.mean,
        image_std: LOCAL_MODEL.std
      };
      const processor = new ImageProcessor(
        processorConfig as unknown as ConstructorParameters<typeof ImageProcessor>[0]
      ) as unknown as LoadedModel['processor'];

      console.info(
        `[Guard model] loaded session on ${device} in ${Math.round(performance.now() - loadStart)}ms`
      );
      return { model, processor };
    })();
  }
  return modelPromise;
}

/**
 * Serializes access to the single shared model. onnxruntime-web cannot run multiple inferences
 * concurrently on one session, so queued calls execute one-at-a-time instead of overlapping.
 */
let inferenceChain: Promise<unknown> = Promise.resolve();
function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const result = inferenceChain.then(task, task);
  // Keep the chain alive regardless of this task's outcome.
  inferenceChain = result.catch(() => {});
  return result;
}

/** Standard logistic function, mapping a raw logit to a 0-1 probability. */
function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

/** Reads the first scalar out of a model output tensor. */
function firstValue(tensor: { data: ArrayLike<number> } | undefined): number {
  const value = tensor?.data?.[0];
  return typeof value === 'number' ? value : 0;
}

/**
 * Runs the local multi-task model on the given image and returns the probability for each category.
 *
 * The image is fetched into a Blob first (identical to the C2PA reader) so cross-origin loading
 * behaves consistently and avoids canvas-tainting issues during pixel extraction.
 *
 * @param src - The absolute URL of the image to classify
 * @returns The three category probabilities (0-1), or null if the model is unavailable
 * @throws {Error} If the image network fetch fails prior to classification
 */
export async function classifyImage(src: string): Promise<LocalModelScores | null> {
  logEnvironmentOnce();

  const response = await fetchWithTimeout(src, MODEL_FETCH_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: HTTP ${response.status}`);
  }

  const blob = await response.blob();

  // Vector images (SVG) can't be rasterized by the browser's `createImageBitmap` on Firefox — it
  // yields an unusable bitmap that throws "object is no longer usable" when drawn — and they're
  // logos/icons the detector can't classify anyway. Skip them (metadata still applies).
  if (blob.type === 'image/svg+xml') {
    return null;
  }

  let image: RawImage;
  try {
    image = await RawImage.fromBlob(blob);
  } catch {
    // Undecodable/unsupported image (corrupt, exotic codec, zero-size): skip the model gracefully.
    return null;
  }

  const { model, processor } = await getModel();

  // Serialize inference: a single onnxruntime-web session can't run concurrent `run()` calls.
  // Preprocessing is included in the critical section to keep each image's work together.
  const outputs = await runSerialized(async () => {
    const { pixel_values } = await processor(image);
    // TEMP: measure per-image inference time (excludes queue wait). Remove once tuned.
    const inferStart = performance.now();
    const result = await model({ input: pixel_values });
    console.info(`[Guard model] inference in ${Math.round(performance.now() - inferStart)}ms`);
    return result;
  });

  // `out_ai` is a raw logit; `out_violence`/`out_nsfw` are already sigmoid probabilities.
  return {
    aiGenerated: sigmoid(firstValue(outputs.out_ai)),
    violent: firstValue(outputs.out_violence),
    explicit: firstValue(outputs.out_nsfw)
  };
}
