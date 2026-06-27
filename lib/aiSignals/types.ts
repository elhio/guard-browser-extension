export interface AiSignal {
  /** Stable identifier for this signal. */
  id: string;
  /** Short human-readable name of the signal. */
  label: string;
  /** What the signal means / why it indicates (or rules out) AI generation. */
  description: string;
  /** Confidence (0-100) that this signal alone implies AI generation. */
  confidence: number;
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
