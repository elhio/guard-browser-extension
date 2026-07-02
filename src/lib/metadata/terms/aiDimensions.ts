/** Width/height pairs that diffusion models commonly default to or are constrained to. */
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
 * Whether `width`x`height` matches a dimension pair AI image generators commonly
 * produce. Weak on its own (real photos get cropped to round numbers too,
 * and 1920x1080 is also an extremely common screenshot/video-still size) —
 * meant to nudge confidence, not decide it alone.
 */
export function looksLikeTypicalAiDimension(width: number | undefined, height: number | undefined): boolean {
  if (!width || !height) return false;
  return TYPICAL_AI_DIMENSIONS.some(([w, h]) => w === width && h === height);
}