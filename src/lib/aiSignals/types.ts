/**
 * What a signal is evidence *of*:
 * - 'ai': the image is AI-generated.
 * - 'authenticity': the image is a genuine real-world capture (e.g. camera EXIF).
 * Defaults to 'ai' when omitted.
 */
export type AiSignalKind = 'ai' | 'authenticity';

export interface AiSignal {
  /** Stable identifier for this signal. */
  id: string;
  /** Short human-readable name of the signal. */
  label: string;
  /** What the signal means / why it indicates (or rules out) AI generation. */
  description: string;
  /** Confidence (0-100) that this signal alone implies AI generation. */
  confidence: number;
  /** Whether this signal points at AI generation or at genuine authenticity. Defaults to 'ai'. */
  kind?: AiSignalKind;
}

export interface AiSignalMatch extends AiSignal {
  /** What was actually found in the data that triggered this signal. */
  evidence: string;
}

export interface AiDetectionResult {
  isLikelyAiGenerated: boolean;
  /** Highest confidence among all matched signals, 0 if none matched. */
  confidence: number;
  matches: AiSignalMatch[];
}