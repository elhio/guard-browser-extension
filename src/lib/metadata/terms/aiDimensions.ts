/**
 * A curated list of specific width/height pairs (in pixels) that popular diffusion models (like Stable Diffusion,
 * Midjourney, and DALL-E) commonly default to or are strictly constrained to
 */
const TYPICAL_AI_DIMENSIONS: ReadonlyArray<readonly [number, number]> = [
  [512, 512],
  [768, 768],
  [1024, 1024],
  [1536, 1536],
  [2048, 2048],
  [1024, 1792],
  [1792, 1024],
  [832, 1216],
  [1216, 832],
  [1344, 768],
  [768, 1344],
  [1152, 896],
  [896, 1152],
  [1920, 1080],
  [1080, 1920]
];

/**
 * Evaluates whether a given width and height perfectly match a dimension pair commonly produced by AI image generators
 *
 * @param width - The image width in pixels
 * @param height - The image height in pixels
 * @returns True if the dimensions strictly match a known AI generation default; otherwise, false
 */
export function looksLikeTypicalAiDimension(width: number | undefined, height: number | undefined): boolean {
  if (!width || !height) return false;
  return TYPICAL_AI_DIMENSIONS.some(([w, h]) => w === width && h === height);
}