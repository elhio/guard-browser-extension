declare const chrome: any;

import { pipeline, env, TextStreamer, RawImage } from '@huggingface/transformers';
import * as ort from 'onnxruntime-web';
import { detectAIFrequencies } from './utils/fft-analysis';

// Configure environment
env.allowLocalModels = false;
env.useWasmCache = false;
if (env.backends.onnx.wasm) {
  const prefix = chrome.runtime.getURL('/wasm/');
  env.backends.onnx.wasm.wasmPaths = {
    wasm: `${prefix}ort-wasm-simd-threaded.jsep.wasm`,
    mjs: `${prefix}ort-wasm-simd-threaded.jsep.mjs`,
    'ort-wasm-simd-threaded.wasm': `${prefix}ort-wasm-simd-threaded.wasm`,
    'ort-wasm-simd-threaded.mjs': `${prefix}ort-wasm-simd-threaded.mjs`,
    'ort-wasm-simd-threaded.asyncify.wasm': `${prefix}ort-wasm-simd-threaded.asyncify.wasm`,
    'ort-wasm-simd-threaded.asyncify.mjs': `${prefix}ort-wasm-simd-threaded.asyncify.mjs`,
    'ort-wasm-simd-threaded.jsep.wasm': `${prefix}ort-wasm-simd-threaded.jsep.wasm`,
    'ort-wasm-simd-threaded.jsep.mjs': `${prefix}ort-wasm-simd-threaded.jsep.mjs`,
    'ort-wasm-simd-threaded.jspi.wasm': `${prefix}ort-wasm-simd-threaded.jspi.wasm`,
    'ort-wasm-simd-threaded.jspi.mjs': `${prefix}ort-wasm-simd-threaded.jspi.mjs`,
  } as any;
  env.backends.onnx.wasm.proxy = false;
  // Use a balanced number of threads for WASM execution to speed up inference
  // without exceeding browser memory/resource allocation limits.
  env.backends.onnx.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);
}

// Configure environment for raw ONNX Runtime Web
const prefix = chrome.runtime.getURL('/wasm/');
ort.env.wasm.wasmPaths = prefix;
ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);

let generator: any = null;
let currentModelId: string | null = null;
let loadedDevice: 'webgpu' | 'wasm' = 'wasm';

// Preprocessor-Konfiguration wird beim Laden des Custom Models aus preprocessor_config.json gelesen
interface PreprocessorConfig {
  image_mean: number[];
  image_std: number[];
  do_normalize: boolean;
  do_rescale: boolean;
  rescale_factor: number;
  do_resize: boolean;
  do_center_crop: boolean;
  do_pad: boolean;
  size?: number;  // wird aus dem ONNX-Modell abgeleitet (518)
}

let customModelConfig: PreprocessorConfig | null = null;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message: any) => {
  if (message.target !== 'offscreen') return;

  switch (message.type) {
    case 'LOAD_MODEL':
      loadModel(message.modelId, message.device, message.hfToken);
      break;
    case 'UNLOAD_MODEL':
      unloadModel();
      break;
    case 'GENERATE_TEXT':
      generateText(message.prompt);
      break;
    case 'CLASSIFY_IMAGE':
      classifyImage(message.imageDataUrl);
      break;
  }
});

function log(text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  chrome.runtime.sendMessage({
    target: 'background',
    type: 'OFFSCREEN_LOG',
    logText: text,
    logType: type
  });
}

function updateStatus(status: any) {
  chrome.runtime.sendMessage({
    target: 'background',
    type: 'OFFSCREEN_STATUS',
    status
  });
}

async function checkWebGpuSupport(): Promise<boolean> {
  const nav = navigator as any;
  if (!nav.gpu) return false;
  try {
    const adapter = await nav.gpu.requestAdapter();
    return adapter !== null;
  } catch (e) {
    return false;
  }
}

async function loadModel(modelId: string, preferredDevice: 'auto' | 'webgpu' | 'cpu' = 'auto', hfToken: string = '') {
  try {
    if (generator) {
      log('Ein anderes Modell ist bereits geladen. Entlade es zuerst...', 'info');
      await unloadModel();
    }
    currentModelId = modelId;
    log(`Ladevorgang gestartet für reales Modell: ${modelId} (Gewünschtes Gerät: ${preferredDevice})`, 'info');
    updateStatus({ status: 'downloading', progress: 0, loadedModelId: modelId });

    // Map the modelId to HF repository
    // In our types, we have: 'qwen-0.5b', 'gemma-3-1b', 'llama-3.2-1b', 'phi-3-mini', 'mobilenet-v2'
    // We map these to modern onnx-community repositories which support 4-bit (q4) quantization
    let hfModel = 'onnx-community/Qwen2.5-0.5B-Instruct';
    let pipelineType: 'text-generation' | 'image-classification' = 'text-generation';

    if (modelId === 'gemma-3-1b') {
      hfModel = 'onnx-community/gemma-3-1b-it-ONNX';
    } else if (modelId === 'llama-3.2-1b') {
      hfModel = 'onnx-community/Llama-3.2-1B-Instruct';
    } else if (modelId === 'phi-3-mini') {
      hfModel = 'onnx-community/Phi-3-mini-4k-instruct-ONNX';
    } else if (modelId === 'mobilenet-v2') {
      hfModel = 'onnx-community/mobilenetv4_conv_small.e2400_r224_in1k';
      pipelineType = 'image-classification';
    } else if (modelId === 'sdxl-detector') {
      hfModel = 'Organika/sdxl-detector';
      pipelineType = 'image-classification';
    } else if (modelId === 'smogy-detector') {
      hfModel = 'onnx-community/SMOGY-Ai-images-detector-ONNX';
      pipelineType = 'image-classification';
    } else if (modelId === 'vit-ai-detector') {
      hfModel = 'onnx-community/ai-image-detection-ONNX';
      pipelineType = 'image-classification';
    }

    // Gated models check - only pass the HF Token if the model requires gating
    const gatedModels = ['gemma-3-1b', 'llama-3.2-1b'];
    const isGated = gatedModels.includes(modelId);
    const requestToken = isGated ? (hfToken || undefined) : undefined;

    // Determine target device
    let targetDevice: 'webgpu' | 'wasm' = 'wasm';
    if (preferredDevice === 'webgpu') {
      targetDevice = 'webgpu';
    } else if (preferredDevice === 'auto') {
      log(`Prüfe WebGPU-Unterstützung des Browsers...`, 'info');
      const hasWebGpu = await checkWebGpuSupport();
      if (hasWebGpu) {
        log(`WebGPU ist verfügbar. Aktiviere GPU-Beschleunigung.`, 'success');
        targetDevice = 'webgpu';
      } else {
        log(`WebGPU nicht verfügbar. Verwende CPU (WebAssembly).`, 'warning');
        targetDevice = 'wasm';
      }
    } else {
      log(`Verwende CPU-Modus (WebAssembly) wie gewünscht.`, 'info');
      targetDevice = 'wasm';
    }

    if (modelId === 'lens-light') {
      log('Lade Custom DINOv2 Model über ONNX Runtime Web...', 'info');
      try {
        // --- 1. Preprocessor-Konfiguration laden ---
        const configUrl = chrome.runtime.getURL('/my-custom-dinov2/preprocessor_config.json');
        log('Lade preprocessor_config.json...', 'info');
        const configResponse = await fetch(configUrl);
        if (!configResponse.ok) {
          throw new Error(`preprocessor_config.json fetch fehlgeschlagen: ${configResponse.status} ${configResponse.statusText}`);
        }
        customModelConfig = await configResponse.json() as PreprocessorConfig;
        // Eingabegröße aus dem Modell-Design setzen (DINOv2 mit 518px)
        customModelConfig.size = 518;
        
        log(`Preprocessor-Config geladen:`, 'success');
        log(`  → Mean: [${customModelConfig.image_mean.join(', ')}]`, 'info');
        log(`  → Std:  [${customModelConfig.image_std.join(', ')}]`, 'info');
        log(`  → Rescale: ${customModelConfig.do_rescale ? `Ja (Faktor: ${customModelConfig.rescale_factor})` : 'Nein'}`, 'info');
        log(`  → Normalize: ${customModelConfig.do_normalize ? 'Ja' : 'Nein'}`, 'info');
        log(`  → Resize: ${customModelConfig.do_resize ? 'Ja' : 'Nein (Bild wird direkt auf Zielgröße skaliert)'}`, 'info');
        log(`  → Center-Crop: ${customModelConfig.do_center_crop ? 'Ja' : 'Nein (Bild wird gestretcht/skaliert)'}`, 'info');
        log(`  → Eingabegröße: ${customModelConfig.size}×${customModelConfig.size}px`, 'info');

        // --- 2. ONNX Graph + Gewichte laden ---
        const modelUrl = chrome.runtime.getURL('/my-custom-dinov2/artifacts_models_lens_light_v1.onnx');
        const dataUrl = chrome.runtime.getURL('/my-custom-dinov2/artifacts_models_lens_light_v1.onnx.data');
        
        log(`Lade Graph-Datei: artifacts_models_lens_light_v1.onnx`, 'info');
        const modelResponse = await fetch(modelUrl);
        if (!modelResponse.ok) {
          throw new Error(`Graph-Datei fetch fehlgeschlagen: ${modelResponse.status} ${modelResponse.statusText}`);
        }
        const modelBuffer = await modelResponse.arrayBuffer();
        
        log(`Lade Gewichts-Datei: artifacts_models_lens_light_v1.onnx.data`, 'info');
        const dataResponse = await fetch(dataUrl);
        if (!dataResponse.ok) {
          throw new Error(`Gewichts-Datei fetch fehlgeschlagen: ${dataResponse.status} ${dataResponse.statusText}`);
        }
        const dataBuffer = await dataResponse.arrayBuffer();
        
        log(`Erstelle ONNX Runtime Session auf ${targetDevice.toUpperCase()}...`, 'info');
        
        const sessionOptions: any = {
          executionProviders: [targetDevice],
          externalData: [
            {
              path: 'lens_light_v1.onnx.data',
              data: new Uint8Array(dataBuffer)
            }
          ]
        };
        
        try {
          generator = await ort.InferenceSession.create(modelBuffer, sessionOptions);
        } catch (sessionErr: any) {
          if (targetDevice === 'webgpu') {
            log(`WebGPU-Session fehlgeschlagen: ${sessionErr.message || sessionErr}. Fallback auf CPU (WASM)...`, 'warning');
            targetDevice = 'wasm';
            sessionOptions.executionProviders = ['wasm'];
            generator = await ort.InferenceSession.create(modelBuffer, sessionOptions);
          } else {
            throw sessionErr;
          }
        }
        
        // --- 3. Modell-Inputs und -Outputs loggen ---
        const inputNames = generator.inputNames || [];
        const outputNames = generator.outputNames || [];
        log(`Modell-Inputs: [${inputNames.join(', ')}]`, 'info');
        log(`Modell-Outputs: [${outputNames.join(', ')}]`, 'info');
        
        log(`Custom DINOv2 Modell erfolgreich auf ${targetDevice.toUpperCase()} geladen!`, 'success');
        loadedDevice = targetDevice;
        updateStatus({
          status: 'loaded',
          progress: 100,
          loadedModelId: modelId,
          allocatedMemoryMB: getNominalRamMB(modelId)
        });
        return;
      } catch (err: any) {
        const errorMsg = err.message || String(err);
        log(`Fehler beim Laden des Custom Models: ${errorMsg}`, 'error');
        customModelConfig = null;
        updateStatus({ status: 'error', errorMsg: errorMsg });
        return;
      }
    }

    log(`Initialisiere ONNX Runtime Web & lade Gewichte für ${hfModel} auf ${targetDevice.toUpperCase()}...`, 'info');

    const progress_callback = (data: any) => {
      if (data.status === 'progress') {
        const progress = Math.round(data.progress || 0);
        const loadedMB = (data.loaded / (1024 * 1024)).toFixed(1);
        const totalMB = (data.total / (1024 * 1024)).toFixed(1);
        log(`Lade ${data.file || 'Dateien'}: ${progress}% (${loadedMB} / ${totalMB} MB)`, 'info');
        updateStatus({ progress: progress });
      } else if (data.status === 'done') {
        log(`Datei geladen: ${data.file}`, 'success');
      } else if (data.status === 'ready') {
        log(`Modell-Datei betriebsbereit.`, 'success');
      }
    };

    // Attempt loading with manual fallback
    const pipelineOptions: any = {
      progress_callback,
      device: targetDevice,
      session_options: {
        enableCpuMemArena: false,
        enableMemPattern: false,
        executionMode: 'sequential',
      },
    };
    if (pipelineType === 'text-generation') {
      pipelineOptions.dtype = 'q4';
    }
    // SDXL detector only ships model.onnx (no quantized variant)
    // 'quantized: false' is deprecated; use dtype: 'fp32' to load model.onnx
    if (modelId === 'sdxl-detector') {
      pipelineOptions.dtype = 'fp32';
    }
    if (requestToken) {
      pipelineOptions.token = requestToken;
    }

    try {
      generator = await pipeline(pipelineType, hfModel, pipelineOptions);
    } catch (err: any) {
      if (targetDevice === 'webgpu') {
        log(`WebGPU-Fehler bei Session-Erstellung: ${err.message || err}. Führe CPU-Fallback (WebAssembly) durch...`, 'warning');
        targetDevice = 'wasm';
        
        const fallbackOptions: any = {
          progress_callback,
          device: 'wasm',
          session_options: {
            enableCpuMemArena: false,
            enableMemPattern: false,
            executionMode: 'sequential',
          },
        };
        if (pipelineType === 'text-generation') {
          fallbackOptions.dtype = 'q4';
        }
        if (modelId === 'sdxl-detector') {
          fallbackOptions.dtype = 'fp32';
        }
        if (requestToken) {
          fallbackOptions.token = requestToken;
        }

        generator = await pipeline(pipelineType, hfModel, fallbackOptions);
      } else {
        throw err;
      }
    }

    log(`Modell ${modelId} erfolgreich auf ${targetDevice.toUpperCase()} geladen. Inferenz bereit.`, 'success');
    loadedDevice = targetDevice;
    updateStatus({
      status: 'loaded',
      progress: 100,
      loadedModelId: modelId,
      allocatedMemoryMB: getNominalRamMB(modelId)
    });
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    log(`Fehler beim Laden des echten Modells: ${errorMsg}`, 'error');
    
    // Check if error is related to memory allocation
    if (errorMsg.includes('bad_alloc') || errorMsg.includes('out of memory') || errorMsg.includes('allocation failed')) {
      log(`DIAGNOSE: Die Fehlerursache ist eine Speicherüberlastung (std::bad_alloc) der WebAssembly CPU Runtime (2-4 GB Limit im Browser).`, 'warning');
      log(`Lösung A: Aktiviere WebGPU in Chrome (gehe zu chrome://flags, suche nach 'WebGPU' & 'Vulkan' und aktiviere beide). WebGPU lagert den Speicher auf die Grafikkarte aus und umgeht das WASM-Limit.`, 'success');
      log(`Lösung B: Wähle ein kompakteres Modell, z. B. 'Qwen-2.5-0.5B-Instruct', da dieses problemlos in das CPU-RAM-Limit passt.`, 'success');
    }
    
    updateStatus({ status: 'error', errorMsg: errorMsg });
  }
}

function getNominalRamMB(modelId: string): number {
  if (modelId === 'qwen-0.5b') return 900;
  if (modelId === 'gemma-3-1b') return 1500;
  if (modelId === 'llama-3.2-1b') return 1800;
  if (modelId === 'phi-3-mini') return 3000;
  if (modelId === 'mobilenet-v2') return 50;
  if (modelId === 'sdxl-detector' || modelId === 'smogy-detector' || modelId === 'vit-ai-detector') return 600;
  if (modelId === 'lens-light') return 250;
  return 800;
}

async function unloadModel() {
  if (!generator) {
    log('Kein Modell zum Entladen vorhanden.', 'warning');
    return;
  }
  log('Reales Modell wird aus dem Speicher entladen...', 'info');
  try {
    if (typeof generator.dispose === 'function') {
      await generator.dispose();
      log('ONNX Runtime Session und Ressourcen freigegeben.', 'success');
    }
  } catch (e: any) {
    log(`Fehler beim Freigeben des Modells: ${e.message || e}`, 'warning');
  }
  generator = null;
  currentModelId = null;
  customModelConfig = null;
  
  log('Speicher erfolgreich freigegeben.', 'success');
  updateStatus({
    status: 'idle',
    progress: 0,
    loadedModelId: null,
    allocatedMemoryMB: 0
  });
}

async function generateText(prompt: string) {
  if (!generator) {
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'OFFSCREEN_STREAM',
      token: '',
      text: '',
      done: true,
      error: 'Modell nicht geladen.'
    });
    return;
  }

  const maxTokens = loadedDevice === 'webgpu' ? 256 : 64;
  log(`Generiere Text für Prompt: "${prompt}" (Gerät: ${loadedDevice.toUpperCase()}, Max Tokens: ${maxTokens})`, 'info');

  try {
    let responseText = '';
    
    // Create a TextStreamer to decode and stream generated tokens in real time
    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        responseText += text;
        chrome.runtime.sendMessage({
          target: 'background',
          type: 'OFFSCREEN_STREAM',
          token: text,
          text: responseText,
          done: false
        });
      }
    });

    // Run generation with the streamer
    const result = await generator(prompt, {
      max_new_tokens: maxTokens,
      streamer: streamer,
    });

    const finalText = result[0]?.generated_text || responseText;
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'OFFSCREEN_STREAM',
      token: '',
      text: finalText,
      done: true
    });
    log('Inferenz abgeschlossen.', 'success');
  } catch (err: any) {
    log(`Fehler bei der Inferenz: ${err.message || err}`, 'error');
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'OFFSCREEN_STREAM',
      token: '',
      text: '',
      done: true,
      error: err.message || String(err)
    });
  }
}

async function classifyImage(imageDataUrl: string) {
  if (!generator) {
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'OFFSCREEN_IMAGE_RESULT',
      results: [],
      done: true,
      error: 'Modell nicht geladen.'
    });
    return;
  }

  // --- Frequenzanalyse (FFT) vorab durchführen ---
  let fftScore: number | undefined;
  try {
    const image = await RawImage.read(imageDataUrl);
    const canvas = image.toCanvas();
    fftScore = detectAIFrequencies(canvas);
    log(`FFT-Analyse abgeschlossen: ${fftScore}% Wahrscheinlichkeit für generative Strukturen`, 'info');
  } catch (err: any) {
    log(`Fehler bei der Frequenzanalyse (FFT): ${err.message || err}`, 'warning');
  }

  if (currentModelId === 'lens-light') {
    await classifyImageCustom(imageDataUrl, fftScore);
    return;
  }

  log(`Klassifiziere Bild...`, 'info');
  try {
    const results = await generator(imageDataUrl);
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'OFFSCREEN_IMAGE_RESULT',
      results: results,
      fftScore: fftScore,
      done: true
    });
    log('Bildklassifizierung erfolgreich abgeschlossen.', 'success');
  } catch (err: any) {
    log(`Fehler bei der Bildklassifizierung: ${err.message || err}`, 'error');
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'OFFSCREEN_IMAGE_RESULT',
      results: [],
      fftScore: fftScore,
      done: true,
      error: err.message || String(err)
    });
  }
}

/**
 * Konvertiert RGB-Pixeldaten (Uint8, 3 Kanäle) in normalisiertes CHW Float32Array.
 * Liest Rescale-Faktor, Mean und Std dynamisch aus customModelConfig.
 *
 * Pipeline laut preprocessor_config.json:
 *   1. Rescale: pixel × rescale_factor (1/255) → [0, 1]
 *   2. Normalize: (pixel - mean) / std
 */
function normalizeToFloat32CHW(data: Uint8ClampedArray | Uint8Array, width: number, height: number, channels: number): Float32Array {
  const cfg = customModelConfig;
  const mean = cfg?.image_mean ?? [0.485, 0.456, 0.406];
  const std  = cfg?.image_std  ?? [0.229, 0.224, 0.225];
  const rescale = cfg?.rescale_factor ?? (1 / 255);
  const doRescale = cfg?.do_rescale ?? true;
  const doNormalize = cfg?.do_normalize ?? true;

  const size = width * height;
  const float32Data = new Float32Array(3 * size);

  for (let i = 0; i < size; ++i) {
    let r = data[i * channels];
    let g = data[i * channels + 1];
    let b = data[i * channels + 2];

    // Schritt 1: Rescale (z.B. ×(1/255) → [0, 1])
    if (doRescale) {
      r *= rescale;
      g *= rescale;
      b *= rescale;
    }

    // Schritt 2: Normalize mit Mean/Std
    if (doNormalize) {
      r = (r - mean[0]) / std[0];
      g = (g - mean[1]) / std[1];
      b = (b - mean[2]) / std[2];
    }

    // CHW-Format (Channel-First)
    float32Data[i]            = r;  // R-Kanal
    float32Data[size + i]     = g;  // G-Kanal
    float32Data[2 * size + i] = b;  // B-Kanal
  }
  return float32Data;
}

/**
 * Hauptfunktion: Lädt ein Bild via RawImage und verarbeitet es proportional.
 * Verwendet Letterbox-Padding (grauer Rand) anstelle von Stretching/Crop,
 * um das exakte Seitenverhältnis zu wahren.
 *
 * Gibt normalisiertes Float32Array im CHW-Format zurück.
 */
async function preprocessImage(
  imageDataUrl: string,
  width: number,
  height: number
): Promise<Float32Array> {
  // Bild über HuggingFace RawImage laden (kein Canvas/DOM nötig)
  let image = await RawImage.read(imageDataUrl);

  // Auf 3 Kanäle (RGB) konvertieren, Alpha-Kanal verwerfen
  image = image.rgb();

  // --- 1. Proportionale Skalierung für Letterboxing berechnen ---
  const scale = Math.min(width / image.width, height / image.height);
  const resizeW = Math.round(image.width * scale);
  const resizeH = Math.round(image.height * scale);
  
  image = await image.resize(resizeW, resizeH);

  // Neues Flat Uint8Array mit neutralem Grau (128) als Hintergrund erstellen
  const paddedData = new Uint8Array(width * height * 3).fill(128);
  const resizedData = image.data as Uint8Array;

  // Offsets zum Zentrieren des Bildes berechnen
  const offsetX = Math.floor((width - resizeW) / 2);
  const offsetY = Math.floor((height - resizeH) / 2);

  // Proportionales Bild in den grauen Rahmen kopieren (Zeile für Zeile)
  for (let y = 0; y < resizeH; ++y) {
    const srcStart = y * resizeW * 3;
    const destStart = ((y + offsetY) * width + offsetX) * 3;
    paddedData.set(resizedData.subarray(srcStart, srcStart + resizeW * 3), destStart);
  }

  // RGB-Pixeldaten normalisieren und in CHW Float32Array umwandeln
  return normalizeToFloat32CHW(paddedData, width, height, 3);
}

async function classifyImageCustom(imageDataUrl: string, fftScore?: number) {
  const inputSize = customModelConfig?.size ?? 518;
  log(`Starte Custom Inferenz (Eingabe: ${inputSize}×${inputSize}px, Letterbox-Padding)...`, 'info');
  try {
    // Originalbild vorbereiten (config-gesteuert, Letterbox)
    const originalData = await preprocessImage(imageDataUrl, inputSize, inputSize);
    const tensor = new ort.Tensor('float32', originalData, [1, 3, inputSize, inputSize]);
    const outputs = await generator.run({ input: tensor });
    console.log(outputs);
    log(`Outputs: ${JSON.stringify(outputs)}`, 'info');

    // Roh-Logits extrahieren (nur der erste Wert des Tensors)
    const rawAi = outputs.out_ai ? (outputs.out_ai.data[0] as number) : 0;
    const rawViolence = outputs.out_violence ? (outputs.out_violence.data[0] as number) : 0;
    const rawNsfw = outputs.out_nsfw ? (outputs.out_nsfw.data[0] as number) : 0;

    // Sigmoid Funktion, um Logits in Wahrscheinlichkeiten [0, 1] umzuwandeln
    const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
    log(`Sigmoid Funktion: ${sigmoid(rawAi)}`, 'info');

    const aiScore = sigmoid(rawAi);
    const violenceScore = sigmoid(rawViolence);
    const nsfwScore = sigmoid(rawNsfw);

    log(`Logits - AI: ${rawAi.toFixed(3)}, Gewalt: ${rawViolence.toFixed(3)}, NSFW: ${rawNsfw.toFixed(3)}`, 'info');
    log(`Ergebnisse - AI: ${(aiScore * 100).toFixed(1)}%, Gewalt: ${(violenceScore * 100).toFixed(1)}%, NSFW: ${(nsfwScore * 100).toFixed(1)}%`, 'success');

    const results = [
      { label: '🤖 KI-Generiert (AI)', score: aiScore },
      { label: '⚠️ Gewalt (Violence)', score: violenceScore },
      { label: '🔞 NSFW / Erwachseneninhalt', score: nsfwScore }
    ];

    chrome.runtime.sendMessage({
      target: 'background',
      type: 'OFFSCREEN_IMAGE_RESULT',
      results: results,
      fftScore: fftScore,
      done: true
    });
    log('Custom Inferenz erfolgreich beendet.', 'success');
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    log(`Fehler bei Custom Inferenz: ${errorMsg}`, 'error');
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'OFFSCREEN_IMAGE_RESULT',
      results: [],
      fftScore: fftScore,
      done: true,
      error: errorMsg
    });
  }
}
