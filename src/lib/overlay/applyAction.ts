import type { ClassifyImageResult } from '@/lib/messaging/classifyMessages';
import { isImageFlagged } from '@/lib/detection';
import type { DetectionAction } from '@/lib/settings';

const BLUR_CLASS = 'guard-action-blur';
const HIDE_CLASS = 'guard-action-hide';
const STYLE_ELEMENT_ID = 'guard-action-style';

/**
 * A registry of all DOM elements that have been flagged for blurring
 */
const flaggedImages = new Set<HTMLElement>();
const explicitlyRevealed = new WeakSet<HTMLElement>();

let currentAction: DetectionAction = 'mark';

/**
 * Dynamically injects the CSS required for blurring into the host page's `<head>`
 */
function ensureStyleInjected(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    /* Blur Action */
    .${BLUR_CLASS} { filter: blur(16px) !important; transition: filter 0.15s ease; }
    
    /* Hide Action - Uses visibility to prevent page layouts from collapsing */
    .${HIDE_CLASS} { visibility: hidden !important; opacity: 0 !important; transition: opacity 0.15s ease; }
  `;
  document.head.append(style);
}

/**
 * Strips all action-related CSS classes from an element
 */
function stripActionClasses(element: HTMLElement): void {
  element.classList.remove(BLUR_CLASS, HIDE_CLASS);
}

/**
 * Updates the global action state and immediately applies it to all currently flagged images
 *
 * @param action - The visual action to take ('mark', 'blur', 'hide')
 */
export function setAction(action: DetectionAction): void {
  currentAction = action;

  if (action === 'blur' || action === 'hide') {
    ensureStyleInjected();
  }

  for (const element of flaggedImages) {
    stripActionClasses(element);
    applyCurrentActionToElement(element);
  }
}

/**
 * Applies the currently selected CSS classes to a specific DOM element based on global state
 */
function applyCurrentActionToElement(element: HTMLElement): void {
  // If the user clicked "Reveal" on this specific image, do not re-apply the action
  if (explicitlyRevealed.has(element)) return;

  if (currentAction === 'blur') {
    element.classList.add(BLUR_CLASS);
  } else if (currentAction === 'hide') {
    element.classList.add(HIDE_CLASS);
  }
}

export function markImageForAction(element: HTMLElement): void {
  flaggedImages.add(element);
  ensureStyleInjected();
  applyCurrentActionToElement(element);
}

/**
 * Permanently removes the blur or hide effect from a specific flagged image
 * (Intended to be called from the badge menu's "Reveal" button)
 */
export function revealImage(element: HTMLElement): void {
  explicitlyRevealed.add(element);
  stripActionClasses(element);
}

/**
 * Re-applies the current action to a previously revealed image (the "Hide again" menu action)
 */
export function hideImage(element: HTMLElement): void {
  explicitlyRevealed.delete(element);
  applyCurrentActionToElement(element);
}

/** The action currently applied to flagged images ('mark' | 'blur' | 'hide'). */
export function getCurrentAction(): DetectionAction {
  return currentAction;
}

/** Whether an image is currently flagged (and thus subject to the blur/hide action). */
export function isImageFlaggedForAction(element: HTMLElement): boolean {
  return flaggedImages.has(element);
}

/** Whether the user has explicitly revealed a flagged image. */
export function isImageRevealed(element: HTMLElement): boolean {
  return explicitlyRevealed.has(element);
}

/**
 * Strips all action-related CSS classes from tracked images and clears the registry
 */
export function clearAllActions(): void {
  for (const element of flaggedImages) {
    stripActionClasses(element);
  }
  flaggedImages.clear();
}

/**
 * Batch-processes a list of C2PA manifest read results
 *
 * @param results - The array of parsed C2PA manifest results
 * @param elementsBySrc - A map linking absolute image URLs back to their live DOM nodes
 */
export function applyAction(
  results: readonly ClassifyImageResult[],
  elementsBySrc: ReadonlyMap<string, HTMLImageElement | undefined>
): void {
  for (const result of results) {
    if (result.status !== 'success') continue;

    // Trigger the action if any category crossed its detection threshold.
    if (!isImageFlagged(result.categories)) continue;

    const element = elementsBySrc.get(result.src);
    if (element) {
      markImageForAction(element);
    }
  }
}