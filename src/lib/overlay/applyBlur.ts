import type { C2paReadResult } from '@/lib/c2pa';

const BLUR_CLASS = 'guard-ai-blur';
const HOVER_UNBLUR_CLASS = 'guard-ai-blur-hover-unblur';
const STYLE_ELEMENT_ID = 'guard-ai-blur-style';

/** * A registry of all DOM elements that have been flagged for blurring
 */
const flaggedImages = new Set<HTMLElement>();

let blurActive = false;
let hoverUnblurActive = false;

/**
 * Dynamically injects the CSS required for blurring into the host page's `<head>`
 */
function ensureStyleInjected(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    .${BLUR_CLASS} { filter: blur(16px) !important; transition: filter 0.15s ease; }
    .${HOVER_UNBLUR_CLASS}.${BLUR_CLASS}:hover { filter: none !important; }
  `;
  document.head.append(style);
}

/**
 * Toggles the ability for users to temporarily unblur images by hovering their mouse over them
 * @param active - True to enable hover-to-unblur, false to strictly enforce the blur.
 */
export function setHoverUnblurActive(active: boolean): void {
  hoverUnblurActive = active;
  for (const element of flaggedImages) {
    element.classList.toggle(HOVER_UNBLUR_CLASS, active);
  }
}

/**
 * Registers an individual DOM element as flagged for obfuscation
 *
 * @param element - The live HTML image element to be tracked and potentially blurred
 */
export function markAiImageForBlur(element: HTMLElement): void {
  flaggedImages.add(element);
  if (blurActive) {
    ensureStyleInjected();
    element.classList.add(BLUR_CLASS);
    element.classList.toggle(HOVER_UNBLUR_CLASS, hoverUnblurActive);
  }
}

/**
 * Toggles the blur effect globally across all registered images
 *
 * @param active - True to activate the blur filter, false to reveal the images
 */
export function setBlurActive(active: boolean): void {
  blurActive = active;
  if (active) ensureStyleInjected();

  for (const element of flaggedImages) {
    element.classList.toggle(BLUR_CLASS, active);
  }
}

/**
 * Strips all blur-related CSS classes from tracked images and clears the registry
 */
export function clearAllBlurredImages(): void {
  for (const element of flaggedImages) {
    element.classList.remove(BLUR_CLASS);
    element.classList.remove(HOVER_UNBLUR_CLASS);
  }
  flaggedImages.clear();
}

/**
 * Batch-processes a list of C2PA manifest read results
 *
 * @param results - The array of parsed C2PA manifest results
 * @param elementsBySrc - A map linking absolute image URLs back to their live DOM nodes
 */
export function applyBlur(
  results: readonly C2paReadResult[],
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>
): void {
  for (const result of results) {
    if (result.status !== 'success' || !result.aiDetection.isLikelyAiGenerated) continue;

    const element = elementsBySrc.get(result.candidate.src);
    if (element) {
      markAiImageForBlur(element);
    }
  }
}