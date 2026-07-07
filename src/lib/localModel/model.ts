/**
 * Represents the configuration and metadata for an on-device machine learning model
 *
 * @property id - The stable, unique identifier for the model
 * @property name - The human-readable display name of the model
 * @property repo - The Hugging Face repository ID containing the ONNX weights, loaded via transformers.js
 * @property description - A brief explanation of the model's architecture, training dataset, and primary use case
 */
export interface LocalModel {
  id: string;
  name: string;
  repo: string;
  description: string;
}

/**
 * The primary local fallback model configuration.
 *
 * This specific model is a Vision Transformer (ViT) image classifier trained on the CIFAKE dataset,
 * optimized to distinguish real photographic captures from AI-generated images.
 */
export const DEFAULT_MODEL: LocalModel = {
  id: 'vit-ai-detector',
  name: 'ViT AI-Image Detector',
  repo: 'onnx-community/ai-image-detection-ONNX',
  description:
    'Vision Transformer (ViT-Base, CIFAKE) for detecting AI-generated images (Stable Diffusion, DALL-E, Midjourney). Apache 2.0.'
};