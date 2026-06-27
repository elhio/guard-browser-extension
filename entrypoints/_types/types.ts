export interface AIModel {
  id: string;
  name: string;
  sizeMB: number;
  ramMB: number;
  description: string;
  parameterCount: string;
  type: 'chat' | 'image-classification';
}

export type ModelStateStatus = 'idle' | 'downloading' | 'loading' | 'loaded' | 'error';

export interface ModelState {
  status: ModelStateStatus;
  progress: number; // 0 to 100
  loadedModelId: string | null;
  allocatedMemoryMB: number;
  errorMsg?: string;
}

export interface LogEntry {
  timestamp: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

// Client to Server Messages (sent via Chrome extension runtime port)
export type ClientMessage =
  | { type: 'GET_STATUS' }
  | { type: 'LOAD_MODEL'; modelId: string }
  | { type: 'UNLOAD_MODEL' }
  | { type: 'GENERATE_TEXT'; prompt: string }
  | { type: 'CLASSIFY_IMAGE'; imageDataUrl: string }
  | { type: 'CLEAR_LOGS' };

// Server to Client Messages (sent via Chrome extension runtime port)
export type ServerMessage =
  | { type: 'STATUS_UPDATE'; status: ModelState; logs: LogEntry[] }
  | { type: 'GENERATION_STREAM'; token: string; text: string; done: boolean; error?: string }
  | { type: 'IMAGE_CLASSIFICATION_RESULT'; results: Array<{ label: string; score: number }>; fftScore?: number; done: boolean; error?: string }
  | { type: 'LOG_UPDATE'; log: LogEntry };

export const AVAILABLE_MODELS: AIModel[] = [
  // {
  //   id: 'qwen-0.5b',
  //   name: 'Qwen-2.5-0.5B-Instruct',
  //   sizeMB: 390,
  //   ramMB: 900,
  //   description: 'Extremely lightweight, fast local LLM (4-bit quantized). Perfect for basic assistant tasks. Fully public, no token required.',
  //   parameterCount: '0.5B',
  //   type: 'chat'
  // },
  // {
  //   id: 'gemma-3-1b',
  //   name: 'Gemma-3-1B-IT',
  //   sizeMB: 750,
  //   ramMB: 1500,
  //   description: 'Google Gemma 3 1B instruction-tuned model (4-bit quantized). Modern, fast, and multi-lingual. Requires HF Access Token.',
  //   parameterCount: '1B',
  //   type: 'chat'
  // },
  // {
  //   id: 'llama-3.2-1b',
  //   name: 'Llama-3.2-1B-Instruct',
  //   sizeMB: 940,
  //   ramMB: 1800,
  //   description: 'Meta Llama 3.2 1B model (4-bit quantized). Strong logical reasoning. Requires HF Access Token.',
  //   parameterCount: '1.2B',
  //   type: 'chat'
  // },
  // {
  //   id: 'phi-3-mini',
  //   name: 'Phi-3-Mini-Instruct',
  //   sizeMB: 2200,
  //   ramMB: 3000,
  //   description: 'Microsoft Phi-3 model (4-bit quantized). Excellent coding helper and reasoning capabilities. Fully public.',
  //   parameterCount: '3.8B',
  //   type: 'chat'
  // },
  // {
  //   id: 'mobilenet-v2',
  //   name: 'MobileNetV4 (Image Classifier)',
  //   sizeMB: 14,
  //   ramMB: 50,
  //   description: 'Ultra-lightweight computer vision model (14 MB). Upload any image to classify it into ImageNet classes (animals, objects, etc.) locally. Fully public.',
  //   parameterCount: '3.4M',
  //   type: 'image-classification'
  // },
  // {
  //   id: 'sdxl-detector',
  //   name: 'SDXL AI-Image Detector',
  //   sizeMB: 340,
  //   ramMB: 600,
  //   description: 'Vision Transformer (ViT) to detect Stable Diffusion (SDXL) generated faces and images locally. Fully private.',
  //   parameterCount: '86M',
  //   type: 'image-classification'
  // },
  // {
  //   id: 'smogy-detector',
  //   name: 'SMOGY AI-Image Detector',
  //   sizeMB: 340,
  //   ramMB: 600,
  //   description: 'Advanced fine-tune of sdxl-detector optimized for newer generative models (Flux, Midjourney v6, DALL-E 3).',
  //   parameterCount: '86M',
  //   type: 'image-classification'
  // },
  // {
  //   id: 'vit-ai-detector',
  //   name: 'ViT AI-Image Detector',
  //   sizeMB: 330,
  //   ramMB: 600,
  //   description: 'Vision Transformer (ViT-Base) trainiert auf dem CIFAKE-Datensatz (~94% Genauigkeit). Erkennt KI-generierte Bilder (Stable Diffusion, DALL-E, Midjourney). Apache 2.0.',
  //   parameterCount: '86M',
  //   type: 'image-classification'
  // },
  {
    id: 'lens-light',
    //name: 'Lens Light V1 (Custom)',
    name: 'Unsr Modell (Lens Light V1)',
    sizeMB: 86,
    ramMB: 250,
    description: 'Eigens geladenes Lokales Klassifizierungs-Modell (Lens Light V1). Erkennt AI-Bilder, Gewalt und NSFW. 518x518px Input.',
    parameterCount: '86M',
    type: 'image-classification'
  }
];

