/** Places a fixed-position badge host element at the top-left corner of a target element. */
export function positionBadgeOverElement(badgeHost: HTMLElement, target: Element): void {
  const rect = target.getBoundingClientRect();
  badgeHost.style.top = `${Math.max(rect.top, 0) + 4}px`;
  badgeHost.style.left = `${Math.max(rect.left, 0) + 4}px`;
}
