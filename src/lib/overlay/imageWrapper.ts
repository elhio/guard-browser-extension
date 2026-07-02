const WRAPPER_MARKER_ATTRIBUTE = 'data-guard-badge-wrapper';

/**
 * Ensures `target` sits inside a small positioning wrapper so a badge can be
 * placed `position: absolute` right next to it in the DOM — it then scrolls
 * and resizes natively with the page, no per-frame repositioning needed.
 * Reuses the existing wrapper if one was already created for this image.
 *
 * Note: this does mutate the page's DOM (one wrapper element inserted around
 * the image, mirroring its computed `display` to minimize layout impact).
 * Pages whose own scripts specifically reparent/replace this exact <img>
 * could be affected — that's the tradeoff for native, lag-free positioning.
 */
export function ensureBadgeWrapper(target: HTMLImageElement): HTMLElement {
  const existingWrapper = target.parentElement;
  if (existingWrapper?.hasAttribute(WRAPPER_MARKER_ATTRIBUTE)) {
    return existingWrapper;
  }

  const wrapper = document.createElement('span');
  wrapper.setAttribute(WRAPPER_MARKER_ATTRIBUTE, '');
  wrapper.style.position = 'relative';
  wrapper.style.display = getComputedStyle(target).display;

  target.replaceWith(wrapper);
  wrapper.append(target);

  return wrapper;
}