/**
 * Configuration for the on-device multi-task classifier.
 *
 * The weights are a custom `fastvit_t8.apple_dist_in1k` backbone exported to ONNX with three output
 * heads (AI-generated, violence, NSFW/explicit) and fp16 quantization. Every head is trained with
 * `BCEWithLogits`, so the graph emits raw logits — `runner.ts` applies the sigmoid. The weights are
 * shipped inside the extension and loaded through `@huggingface/transformers` (`AutoModel`), so
 * the config points at a local directory rather than a Hugging Face repo id.
 *
 * @property id - Stable, unique identifier for the model
 * @property name - Human-readable display name
 * @property dir - Extension-relative directory containing `config.json` and `onnx/` (resolved via `chrome.runtime.getURL`)
 * @property dtype - transformers.js dtype selecting the ONNX filename suffix (`int8` → `onnx/model_int8.onnx`, `fp16` → `onnx/model_fp16.onnx`)
 * @property device - Execution-provider preference. `'auto'` uses WebGPU for fp16/fp32 weights when
 *   available (int8 dynamic quantization has poor WebGPU kernel support, so `'auto'` keeps it on
 *   WASM); `'webgpu'`/`'wasm'` force a provider. The runner always falls back to WASM if the
 *   preferred provider can't initialize.
 * @property imageSize - Square input resolution the model expects (pixels)
 * @property mean - Per-channel normalization mean (ImageNet, RGB)
 * @property std - Per-channel normalization standard deviation (ImageNet, RGB)
 * @property description - Short explanation of the architecture and purpose
 */
export interface LocalModel {
  id: string;
  name: string;
  dir: string;
  dtype: 'int8' | 'fp16' | 'fp32';
  device: 'auto' | 'webgpu' | 'wasm';
  imageSize: number;
  mean: [number, number, number];
  std: [number, number, number];
  description: string;
}

/**
 * The on-device model used when the user enables local detection.
 */
export const LOCAL_MODEL: LocalModel = {
  id: 'lens-tiny-v1',
  name: 'Lens Tiny v1',
  dir: '/models/lens_tiny_v1',
  dtype: 'fp16',
  device: 'auto',
  imageSize: 256,
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
  description:
    'Custom multi-task FastViT-T8 (fp16) detecting AI-generated, violent, and explicit imagery.'
};
