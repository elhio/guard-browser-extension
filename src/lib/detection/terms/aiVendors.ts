/**
 * The single canonical list of known AI image-generation tools, models, and vendor
 * name fragments. Shared by the free-text metadata detectors and the C2PA manifest
 * vendor matcher so both agree on what counts as an AI generator.
 *
 * Entries are lower-cased name *fragments* intended for lenient substring matching
 * against fields like `softwareAgent`, `claim_generator`, action descriptions, and
 * flattened EXIF/XMP/IPTC/ICC text (which often carry versioned forms like
 * "Product/1.0" or "Service API").
 */
export const AI_GENERATOR_VENDORS: readonly string[] = [
  'dall-e',
  'dalle',
  'openai',
  'chatgpt',
  'gpt-image',
  'midjourney',
  'stable diffusion',
  'stablediffusion',
  'sdxl',
  'stability ai',
  'stability.ai',
  'flux',
  'black forest labs',
  'comfyui',
  'automatic1111',
  'a1111',
  'invokeai',
  'leonardo',
  'leonardo.ai',
  'leonardo ai',
  'ideogram',
  'firefly',
  'adobe firefly',
  'runway',
  'runwayml',
  'runway ml',
  'sora',
  'imagen',
  'gemini',
  'google generative ai',
  'synthid',
  'veo',
  'recraft',
  'krea',
  'nightcafe',
  'dreamstudio',
  'playground ai',
  'craiyon',
  'bing image creator',
  'copilot designer',
  'grok imagine',
];
