/**
 * A curated list of terms and parameters that strongly indicate an asset was synthetically generated or modified by AI
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

/**
 * A curated list of terms that strongly indicate an image is an authentic, real-world photograph captured by a physical
 * camera
 */
export const CAMERA_SOURCE_TERMS: readonly string[] = [
  'digitalcapture',
  'digital capture',
  'original digital capture',
  'camera capture',
  'captured by camera'
];