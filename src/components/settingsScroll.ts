export interface SettingsScrollMetrics {
  /** Viewport top of the target element. */
  targetTop: number;
  /** Viewport top of the scroll container. */
  containerTop: number;
  containerScrollTop: number;
  containerScrollHeight: number;
  containerClientHeight: number;
}

/**
 * Scroll offset that brings `target` to the top of the container.
 *
 * Only a target offset is ever written to the scroll container, so the root document is never
 * scrolled and the horizontal axis stays at 0 (the previous `scrollIntoView` call could move every
 * scrollable ancestor and the visual viewport, which broke the whole layout).
 */
export function settingsScrollTop(metrics: SettingsScrollMetrics, padding = 12): number {
  const maxScroll = Math.max(0, metrics.containerScrollHeight - metrics.containerClientHeight);
  const desired = metrics.containerScrollTop + (metrics.targetTop - metrics.containerTop) - padding;
  return Math.min(Math.max(0, desired), maxScroll);
}
