export interface LocalModel {
  id: string;
  name: string;
  /** Hugging Face repo id (ONNX) loaded via transformers.js. */
  repo: string;
  description: string;
}

/**
 * The single local fallback model. Used by default whenever the user asks for a
 * local analysis — there is intentionally only one model to keep things simple.
 *
 * A Vision Transformer (ViT) image classifier trained on the CIFAKE dataset
 * that distinguishes real photos from AI-generated images.
 */
export const DEFAULT_MODEL: LocalModel = {
  id: 'vit-ai-detector',
  name: 'ViT AI-Image Detector',
  repo: 'onnx-community/ai-image-detection-ONNX',
  description:
    'Vision Transformer (ViT-Base, CIFAKE) zur Erkennung KI-generierter Bilder (Stable Diffusion, DALL-E, Midjourney). Apache 2.0.'
};
