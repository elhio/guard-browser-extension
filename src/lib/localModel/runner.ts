import { env, AutoModel, ImageProcessor, RawImage, Tensor } from '@huggingface/transformers';
import { browser } from 'wxt/browser';
import { LOCAL_MODEL } from './model';

/**
 * Resolves an extension-relative asset path to an absolute URL.
 *
 * `getURL` must be **called on `browser.runtime`**, never detached into a standalone reference:
 * Chrome's copy is natively bound and survives that, but Safari's relies on its receiver and quietly
 * returns `undefined` instead. The damage surfaces nowhere near the cause — transformers.js takes the
 * undefined path into `pathJoin`, which throws `undefined is not an object (evaluating 't.replace')`
 * and looks like a model/provider failure.
 *
 * The cast only widens the path type: WXT types `getURL` against a generated union of known public
 * paths, and the weights and ORT WASM live in asset dirs (`/models/...`, `/wasm/`) that aren't in it.
 */
const getAssetUrl = (path: string): string =>
  (browser.runtime.getURL as (assetPath: string) => string)(path);

/**
 * Environment configuration for transformers.js inside a web extension.
 * Extension pages cannot pull WASM binaries from a CDN due to the strict Content Security Policy,
 * so onnxruntime-web is pointed at the local binaries shipped in `/wasm`. The weights are packaged
 * locally too, so remote model fetches are disabled entirely.
 */
env.allowLocalModels = true;
env.allowRemoteModels = false;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = getAssetUrl('/wasm/');
  // Multi-threaded WASM requires SharedArrayBuffer, which needs cross-origin isolation that the
  // offscreen context doesn't have. Pin to a single thread so onnxruntime-web doesn't spin up a
  // thread pool it can't use (a failed fallback that wastes time without speeding inference up).
  env.backends.onnx.wasm.numThreads = 1;
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
      const model = (await AutoModel.from_pretrained(getAssetUrl(LOCAL_MODEL.dir), {
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
 * `preprocessor_config.json` on disk — and only rescales and normalizes with ImageNet statistics;
 * the geometry is handled up front by {@link letterbox}, which mirrors how the model was trained.
 */
function getModel(): Promise<LoadedModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const loadStart = performance.now();
      const { model, device } = await loadModelWithFallback();

      // Resizing and padding are handled by `letterbox()`, which the processor can't reproduce, so
      // it is left with just the pixel maths: rescale to 0-1, then normalize with ImageNet stats.
      // The config is assembled separately and cast because the base ImageProcessor honors these
      // keys at runtime but they're missing from its published config type.
      const processorConfig = {
        do_resize: false,
        do_pad: false,
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

/**
 * Reproduces the training-time letterbox: scale the longest edge down to `size` (preserving the
 * aspect ratio), then centre the result on a `size`×`size` square, filling the short axis by
 * REPLICATING THE EDGE PIXELS rather than with a constant colour — so the model never sees an
 * artificial border it wasn't trained on.
 *
 * This is done by hand because transformers.js can't express it: its `pad_image` supports only
 * `constant` and `symmetric` padding (and `symmetric` rejects centring), and the base
 * `ImageProcessor` calls it with no options at all — always constant-filling with 0 (which, being
 * applied after normalization, is the ImageNet mean colour) and anchoring the image top-left. The
 * processor is therefore left to do only rescale + normalize.
 *
 * @param image - The decoded source image
 * @param size - Target square resolution (`LOCAL_MODEL.imageSize`)
 * @returns A `size`×`size` RGB image ready for rescale/normalize
 */
async function letterbox(image: RawImage, size: number): Promise<RawImage> {
  const rgb = image.rgb();
  const scale = size / Math.max(rgb.width, rgb.height);
  // The training transform derives its target with Python's `int()`, which truncates — match it.
  const width = Math.max(1, Math.floor(rgb.width * scale));
  const height = Math.max(1, Math.floor(rgb.height * scale));

  const resized = await rgb.resize(width, height, { resample: 3 /* bicubic */ });
  if (width === size && height === size) return resized;

  // Left/top offsets match the training transform's `pad // 2` split.
  const left = Math.floor((size - width) / 2);
  const top = Math.floor((size - height) / 2);

  const src = resized.data;
  const out = new Uint8ClampedArray(size * size * 3);

  // Clamping each source coordinate back into the image IS edge replication: every padded pixel
  // resolves to the nearest real pixel, and pixels inside the image map to themselves.
  for (let y = 0; y < size; y++) {
    const sy = Math.min(Math.max(y - top, 0), height - 1);
    for (let x = 0; x < size; x++) {
      const sx = Math.min(Math.max(x - left, 0), width - 1);
      const s = (sy * width + sx) * 3;
      const d = (y * size + x) * 3;
      out[d] = src[s];
      out[d + 1] = src[s + 1];
      out[d + 2] = src[s + 2];
    }
  }

  return new RawImage(out, size, size, 3);
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
 * Takes the already-downloaded image blob (fetched once by the caller and shared with the
 * metadata/C2PA reader) so the extension never downloads the same image twice.
 *
 * @param blob - The image bytes to classify
 * @returns The three category probabilities (0-1), or null if the model can't process this image
 */
export async function classifyImage(blob: Blob): Promise<LocalModelScores | null> {
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
    const { pixel_values } = await processor(await letterbox(image, LOCAL_MODEL.imageSize));
    return model({ input: pixel_values });
  });

  // Every head is trained with `BCEWithLogits`, so all three outputs are raw logits (unbounded, and
  // frequently negative) — each needs a sigmoid to become a 0-1 probability.
  return {
    aiGenerated: sigmoid(firstValue(outputs.out_ai)),
    violent: sigmoid(firstValue(outputs.out_violence)),
    explicit: sigmoid(firstValue(outputs.out_nsfw))
  };
}
