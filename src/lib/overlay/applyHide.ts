import type { C2paReadResult } from '@/lib/c2pa';

const HIDE_CLASS = 'guard-ai-hide';
const HOVER_UNHIDE_CLASS = 'guard-ai-hide-hover-unhide';
const STYLE_ELEMENT_ID = 'guard-ai-hide-style';

/**
 * A registry of all DOM elements that have been flagged for hiding
 */
const flaggedImages = new Set<HTMLElement>();

let hideActive = false;
let hoverUnhideActive = false;

/**
 * Dynamically injects the CSS required for the black box effect into the host page's `<head>`
 */
function ensureStyleInjected(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    .${HIDE_CLASS} { 
      filter: brightness(0) !important; 
      background-color: #000 !important; 
      transition: filter 0.15s ease, background-color 0.15s ease; 
    }
    .${HOVER_UNHIDE_CLASS}.${HIDE_CLASS}:hover { 
      filter: none !important; 
      background-color: transparent !important; 
    }
  `;
  document.head.append(style);
}

/**
 * Toggles the ability for users to temporarily reveal images by hovering their mouse over them
 *
 * @param active - True to enable hover-to-reveal, false to strictly enforce the black box.
 */
export function setHoverUnhideActive(active: boolean): void {
  hoverUnhideActive = active;
  for (const element of flaggedImages) {
    element.classList.toggle(HOVER_UNHIDE_CLASS, active);
  }
}

/**
 * Registers an individual DOM element as flagged for obfuscation
 *
 * @param element - The live HTML image element to be tracked and potentially hidden.
 */
export function markAiImageForHide(element: HTMLElement): void {
  flaggedImages.add(element);
  if (hideActive) {
    ensureStyleInjected();
    element.classList.add(HIDE_CLASS);
    element.classList.toggle(HOVER_UNHIDE_CLASS, hoverUnhideActive);
  }
}

/**
 * Toggles the black box effect globally across all registered images
 *
 * @param active - True to activate the black box, false to reveal the images.
 */
export function setHideActive(active: boolean): void {
  hideActive = active;
  if (active) ensureStyleInjected();

  for (const element of flaggedImages) {
    element.classList.toggle(HIDE_CLASS, active);
  }
}

/**
 * Strips all hide-related CSS classes from tracked images and clears the registry
 */
export function clearAllHiddenImages(): void {
  for (const element of flaggedImages) {
    element.classList.remove(HIDE_CLASS);
    element.classList.remove(HOVER_UNHIDE_CLASS);
  }
  flaggedImages.clear();
}

/**
 * Batch-processes a list of C2PA manifest read results
 *
 * @param results - The array of parsed C2PA manifest results
 * @param elementsBySrc - A map linking absolute image URLs back to their live DOM nodes
 */
export function applyHide(
  results: readonly C2paReadResult[],
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>
): void {
  for (const result of results) {
    if (result.status !== 'success' || !result.aiDetection.isLikelyAiGenerated) continue;

    const element = elementsBySrc.get(result.candidate.src);
    if (element) {
      markAiImageForHide(element);
    }
  }
}