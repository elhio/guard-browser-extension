/**
 * Represents the core categories of content moderation and detection supported by the system
 */
export type DetectionCategory = 'aiGenerated' | 'violent' | 'explicit';

/**
 * Which detection categories the user has enabled. Keyed by `DetectionCategory`,
 * so tasks and categories can never drift apart.
 */
export type TasksState = Record<DetectionCategory, boolean>;

/**
 * Indicates the specific conclusion or evidence direction a signal provides
 *
 * - For AI generation: `aiGenerated` (synthetic) vs. `authentic` (real-world capture)
 * - For Violence: `violence` vs. `safe`
 * - For Explicit content: `explicit` vs. `safe`
 */
export type SignalKind =
  | 'aiGenerated'
  | 'authentic'
  | 'violence'
  | 'safe'
  | 'explicit';

/**
 * Represents a single rule, heuristic, or model output used to evaluate a piece of content
 *
 * @property id - Stable, unique identifier for this specific signal
 * @property category - The overarching moderation category this signal evaluates
 * @property label - Short, human-readable name of the signal
 * @property description - Detailed explanation of what the signal means and why it indicates a violation
 * @property confidence - The confidence score (0-100) that this signal alone implies a category violation
 * @property kind - The specific direction of evidence this signal provides
 */
export interface DetectionSignal {
  id: string;
  category: DetectionCategory;
  label: string;
  description: string;
  confidence: number;
  kind?: SignalKind;
}

/**
 * Represents a triggered detection signal alongside the real-world data that activated it
 *
 * @property evidence - The actual data, metadata tag, or context found in the image that triggered this signal
 */
export interface DetectionSignalMatch extends DetectionSignal {
  evidence: string;
}

/**
 * Represents the aggregated final verdict and supporting evidence for a single detection category
 *
 * @property detected - True if the system confirms that the content violates or falls into this category
 * @property confidence - The highest confidence score (0-100) among all matched signals, or 0 if none matched
 * @property matches - The collection of all specific evidence and signals found related to this category
 */
export interface CategoryDetectionResult {
  detected: boolean;
  confidence: number;
  matches: DetectionSignalMatch[];
}

/**
 * The comprehensive analysis payload for a single image, containing verdicts across all detection tasks
 *
 * @property src - The URL or source URI of the image that was analyzed
 * @property categories - The isolated detection verdicts. Only the requested categories will be present
 */
export interface ImageAnalysisResult {
  src: string;
  categories: {
    aiGenerated?: CategoryDetectionResult;
    explicit?: CategoryDetectionResult;
    violent?: CategoryDetectionResult;
  };
}