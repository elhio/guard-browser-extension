import type { DetectionCategory } from './types';

/**
 * The minimum confidence score (0-100) required to consider a category actively "detected"
 */
export const DETECTION_THRESHOLDS: Record<DetectionCategory, number> = {
  aiGenerated: 90,
  violent: 70,
  explicit: 70,
};

/**
 * Helper function to determine if a calculated score triggers a detection
 *
 * @param category - The moderation category being evaluated.
 * @param score - The calculated confidence score (0-100).
 * @returns True if the score meets or exceeds the threshold.
 */
export function passesThreshold(category: DetectionCategory, score: number): boolean {
  return score >= DETECTION_THRESHOLDS[category];
}