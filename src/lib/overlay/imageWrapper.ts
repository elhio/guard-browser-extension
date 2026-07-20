/**
 * A unique HTML attribute injected into the DOM to mark our custom wrapper elements
 */
const WRAPPER_MARKER_ATTRIBUTE = 'data-guard-badge-wrapper';

/**
 * Ensures a target image sits inside a localized positioning wrapper
 *
 * Note: This allows a badge to be placed `position: absolute` directly next to it in the DOM,
 * meaning the badge will natively scroll and resize with the page without requiring
 * heavy JavaScript `requestAnimationFrame` repositioning loops. This function explicitly mutates
 * the host page's DOM by inserting a new `<span>` around the target image. It mirrors the image's
 * computed `display` property to minimize visual layout shifts. However, host page scripts that
 * strictly rely on the target's original parent element (e.g., rigid React structures)
 * might be affected. This is the calculated tradeoff for achieving native, lag-free UI positioning.
 *
 * @param target - The live `HTMLImageElement` on the page that needs to be wrapped
 * @returns The `HTMLElement` wrapper (either newly created or retrieved if it already existed)
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