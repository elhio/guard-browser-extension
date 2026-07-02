/**
 * Terms that describe an asset's origin as synthetic/generated, or that are
 * generation parameters specific to diffusion-model tools (img2img UIs like
 * Automatic1111/ComfyUI commonly embed these directly into image metadata).
 */
export const AI_SOURCE_TERMS: readonly string[] = [
  'trainedalgorithmicmedia',
  'compositewithtrainedalgorithmicmedia',
  'algorithmicmedia',
  'generative ai',
  'ai generated',
  'ai-generated',
  'synthetic media',
  'text-to-image',
  'txt2img',
  'img2img',
  'prompt',
  'negative prompt',
  'seed',
  'sampler',
  'cfg scale',
  'denoising strength'
];

/** Terms that describe a genuine camera/digital capture (the opposite signal). */
export const CAMERA_SOURCE_TERMS: readonly string[] = [
  'digitalcapture',
  'digital capture',
  'original digital capture',
  'camera capture',
  'captured by camera'
];