const BLUR_CLASS = 'guard-ai-blur';
const HOVER_UNBLUR_CLASS = 'guard-ai-blur-hover-unblur';
const STYLE_ELEMENT_ID = 'guard-ai-blur-style';

const flaggedImages = new Set<HTMLElement>();
let blurActive = false;
let hoverUnblurActive = false;

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

/** Turns hover-to-unblur on/off; only meaningful while blur mode is active. */
export function setHoverUnblurActive(active: boolean): void {
  hoverUnblurActive = active;
  for (const element of flaggedImages) {
    element.classList.toggle(HOVER_UNBLUR_CLASS, active);
  }
}

/** Marks `element` as AI-flagged; blurred immediately if blur mode is currently active. */
export function markAiImageForBlur(element: HTMLElement): void {
  flaggedImages.add(element);
  if (blurActive) {
    ensureStyleInjected();
    element.classList.add(BLUR_CLASS);
    element.classList.toggle(HOVER_UNBLUR_CLASS, hoverUnblurActive);
  }
}

/** Turns blurring on/off for every image flagged so far (e.g. from the popup toggle). */
export function setBlurActive(active: boolean): void {
  blurActive = active;
  if (active) ensureStyleInjected();
  for (const element of flaggedImages) {
    element.classList.toggle(BLUR_CLASS, active);
  }
}

/** Unblurs and forgets every flagged image (e.g. when detection is turned off). */
export function clearAllBlurredImages(): void {
  for (const element of flaggedImages) {
    element.classList.remove(BLUR_CLASS);
  }
  flaggedImages.clear();
}
