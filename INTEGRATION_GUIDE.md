# 🔌 Integration Guide: Lens Light (DINOv2) ONNX Model

This guide explains how to load, import, and run the custom DINOv2 multi-task classification model in any JavaScript environment (Browser or Node.js).

---

## 📦 1. Installation & Imports

Depending on your target environment, install the required packages:

### Browser (Web)
```bash
npm install onnxruntime-web @huggingface/transformers
```

```javascript
import * as ort from 'onnxruntime-web';
import { RawImage } from '@huggingface/transformers';
```

### Backend (Node.js)
```bash
npm install onnxruntime-node @huggingface/transformers
```

```javascript
import * as ort from 'onnxruntime-node';
import { RawImage } from '@huggingface/transformers';
```

---

## 📂 2. Directory Structure

Ensure your static assets (model graph, weights, and preprocessor config) are hosted in a public/static folder:

```
public/
└── my-custom-dinov2/
    ├── preprocessor_config.json
    ├── artifacts_models_lens_light_v1.onnx      (Model Graph)
    └── artifacts_models_lens_light_v1.onnx.data (Weights)
```

---

## 🚀 3. Complete Integration Code (JavaScript / ES Modules)

Here is the complete implementation to load the config, load the model, preprocess an image, and run inference.

```javascript
import * as ort from 'onnxruntime-web'; // Or 'onnxruntime-node'
import { RawImage } from '@huggingface/transformers';

// Global state
let session = null;
let preprocessorConfig = null;

/**
 * 1. Load Preprocessor Config and ONNX Model Session
 * @param {string} baseFolderUrl - Path/URL to the model folder (e.g. '/my-custom-dinov2')
 */
export async function initializeModel(baseFolderUrl) {
  try {
    // A. Load preprocessor config
    const configRes = await fetch(`${baseFolderUrl}/preprocessor_config.json`);
    preprocessorConfig = await configRes.json();
    preprocessorConfig.size = 518; // DINOv2 target size
    console.log("Preprocessor configuration loaded successfully.");

    // B. Load ONNX model and external weights
    const modelUrl = `${baseFolderUrl}/artifacts_models_lens_light_v1.onnx`;
    const dataUrl = `${baseFolderUrl}/artifacts_models_lens_light_v1.onnx.data`;

    // In a browser environment, fetch files as ArrayBuffers
    const modelBuffer = await (await fetch(modelUrl)).arrayBuffer();
    const dataBuffer = await (await fetch(dataUrl)).arrayBuffer();

    // Map external data weights to the expected path inside the ONNX file
    const sessionOptions = {
      executionProviders: ['webgpu', 'wasm'], // fallbacks
      externalData: [
        {
          path: 'lens_light_v1.onnx.data',
          data: new Uint8Array(dataBuffer)
        }
      ]
    };

    // Create session
    session = await ort.InferenceSession.create(modelBuffer, sessionOptions);
    console.log("ONNX Session created successfully. Ready for inference.");
  } catch (error) {
    console.error("Initialization failed:", error);
    throw error;
  }
}

/**
 * 2. Preprocess raw image data into standard DINOv2 CHW Float32 input format using Letterboxing
 */
async function preprocessImage(imageSource, size) {
  // Load image using HF RawImage (supports URLs, Local Paths, DataUrls, Buffers, etc.)
  let image = await RawImage.read(imageSource);
  image = image.rgb(); // Convert to 3 channels (RGB)

  // Letterbox: Scale proportionally so that the longer edge matches the target size
  const scale = Math.min(size / image.width, size / image.height);
  const resizeW = Math.round(image.width * scale);
  const resizeH = Math.round(image.height * scale);
  image = await image.resize(resizeW, resizeH);

  // Create a new flat buffer filled with neutral gray (128)
  const paddedData = new Uint8Array(size * size * 3).fill(128);
  const resizedData = image.data; // flat Uint8Array of resized image [R, G, B, ...]

  // Calculate centering offsets
  const offsetX = Math.floor((size - resizeW) / 2);
  const offsetY = Math.floor((size - resizeH) / 2);

  // Copy resized pixels into the padded background row-by-row
  for (let y = 0; y < resizeH; ++y) {
    const srcStart = y * resizeW * 3;
    const destStart = ((y + offsetY) * size + offsetX) * 3;
    paddedData.set(resizedData.subarray(srcStart, srcStart + resizeW * 3), destStart);
  }

  // Normalization parameters
  const mean = preprocessorConfig.image_mean ?? [0.485, 0.456, 0.406];
  const std = preprocessorConfig.image_std ?? [0.229, 0.224, 0.225];
  const rescaleFactor = preprocessorConfig.rescale_factor ?? (1 / 255);

  const numPixels = size * size;
  const outputBuffer = new Float32Array(3 * numPixels);

  // Convert HWC [0,255] RGB to CHW Float32 Normalized Tensor
  for (let i = 0; i < numPixels; ++i) {
    let r = paddedData[i * 3];
    let g = paddedData[i * 3 + 1];
    let b = paddedData[i * 3 + 2];

    if (preprocessorConfig.do_rescale) {
      r *= rescaleFactor;
      g *= rescaleFactor;
      b *= rescaleFactor;
    }

    if (preprocessorConfig.do_normalize) {
      r = (r - mean[0]) / std[0];
      g = (g - mean[1]) / std[1];
      b = (b - mean[2]) / std[2];
    }

    // Channel-first (CHW) order
    outputBuffer[i] = r;                  // Red Channel
    outputBuffer[numPixels + i] = g;      // Green Channel
    outputBuffer[2 * numPixels + i] = b;  // Blue Channel
  }

  return outputBuffer;
}

/**
 * 3. Classify Image (Main Inference)
 * @param {string|Buffer} imageSource - URL, DataURL, File Path, or Image Buffer
 * @returns {Promise<{ai: number, violence: number, nsfw: number}>} - Classification scores [0.0 - 1.0]
 */
export async function classifyImage(imageSource) {
  if (!session || !preprocessorConfig) {
    throw new Error("Model is not initialized. Please call initializeModel() first.");
  }

  const inputSize = preprocessorConfig.size;
  
  // A. Preprocess image
  const inputData = await preprocessImage(imageSource, inputSize);
  
  // B. Create ONNX Tensor
  const inputTensor = new ort.Tensor('float32', inputData, [1, 3, inputSize, inputSize]);

  // C. Execute inference
  const outputs = await session.run({ input: inputTensor });

  // D. Extract raw logits from model outputs
  const rawAi = outputs.out_ai ? outputs.out_ai.data[0] : 0;
  const rawViolence = outputs.out_violence ? outputs.out_violence.data[0] : 0;
  const rawNsfw = outputs.out_nsfw ? outputs.out_nsfw.data[0] : 0;

  // Print raw logits to the console
  console.log("Raw Model Logits (Raw outputs):", {
    ai_logit: rawAi,
    violence_logit: rawViolence,
    nsfw_logit: rawNsfw
  });

  // E. Convert logits to probabilities using Sigmoid
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));

  return {
    ai: sigmoid(rawAi),
    violence: sigmoid(rawViolence),
    nsfw: sigmoid(rawNsfw)
  };
}
