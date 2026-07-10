import { readManifestFor } from '@/lib/c2pa';
import {
  passesThreshold,
  type DetectionCategory,
  type SignalKind,
  type TasksState,
  type ImageAnalysisResult
} from '@/lib/detection';
import { fetchWithTimeout } from '@/lib/net/fetchWithTimeout';
import type { SerializableImageCandidate } from '@/lib/images';
import type { ClassifyImageResult } from '@/lib/messaging/classifyMessages';
import type { LocalModelScores } from '@/lib/localModel/runner';

/** How long to wait for the source image download before treating this candidate as failed. */
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

/** The evidence direction each category's model score points to when it fires vs. when it's clear. */
const MODEL_KINDS: Record<DetectionCategory, { positive: SignalKind; safe: SignalKind }> = {
  aiGenerated: { positive: 'aiGenerated', safe: 'authentic' },
  violent: { positive: 'violence', safe: 'safe' },
  explicit: { positive: 'explicit', safe: 'safe' }
};

/** Human-readable label per category for the local model's evidence entry. */
const MODEL_LABELS: Record<DetectionCategory, string> = {
  aiGenerated: 'Local AI Model',
  violent: 'Local Violence Model',
  explicit: 'Local Explicit Model'
};

/**
 * Folds the local model's per-category scores into the metadata analysis. Each enabled category
 * gains a model-derived evidence entry, and the category's overall confidence/verdict is raised
 * whenever the model is more confident than the metadata signals found so far.
 */
function mergeModelScores(
  analysis: ImageAnalysisResult,
  scores: LocalModelScores,
  tasks: TasksState
): void {
  for (const category of Object.keys(MODEL_KINDS) as DetectionCategory[]) {
    if (!tasks[category]) continue;

    const score = scores[category];
    const percent = Math.round(score * 100);
    const kinds = MODEL_KINDS[category];

    if (!analysis.categories[category]) {
      analysis.categories[category] = { detected: false, confidence: 0, matches: [] };
    }
    const bucket = analysis.categories[category]!;

    // Record the model result as its own piece of evidence.
    bucket.matches.push({
      id: `local-model-${category}`,
      category,
      label: MODEL_LABELS[category],
      description: 'Inference result from the locally running on-device model',
      confidence: percent,
      kind: score > 0.5 ? kinds.positive : kinds.safe,
      evidence: `Model confidence score: ${percent}%`
    });

    // Ensure the overall confidence reflects the highest signal found.
    if (percent > bucket.confidence) {
      bucket.confidence = percent;
      bucket.detected = passesThreshold(category, percent);
    }
  }
}

/**
 * Analyzes a batch of image candidates: reads C2PA/EXIF/XMP/IPTC metadata and, when the local
 * model is enabled, folds its scores in. Each candidate is processed independently so a single
 * fetch failure or model error becomes that candidate's error result without affecting the others.
 *
 * This is the shared classification core. It runs wherever a DOM is available: the offscreen
 * document on Chrome (whose background is a DOM-less service worker) and directly in the
 * background page on Firefox (which has no offscreen API but a full-page background context).
 */
export async function classifyCandidates(
  candidates: SerializableImageCandidate[],
  tasks: TasksState,
  useDetectorLocalModel: boolean
): Promise<ClassifyImageResult[]> {
  const finalResults: ClassifyImageResult[] = [];

  let classifyImage: ((blob: Blob) => Promise<LocalModelScores | null>) | null = null;
  if (useDetectorLocalModel && (tasks.aiGenerated || tasks.violent || tasks.explicit)) {
    const runner = await import('@/lib/localModel/runner');
    classifyImage = runner.classifyImage;
  }

  for (const candidate of candidates) {
    try {
      // Download the image once and share the bytes with both the metadata/C2PA reader and the
      // local model, so the extension never re-downloads an image it already has. A fetch failure
      // or timeout is a genuine failure — let it throw so this one badge is marked failed without
      // affecting any other image.
      const response = await fetchWithTimeout(candidate.src, IMAGE_FETCH_TIMEOUT_MS);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: HTTP ${response.status}`);
      }
      const blob = await response.blob();

      const analysis = await readManifestFor(candidate, blob);

      if (classifyImage) {
        try {
          // Best-effort: a model failure must never discard the metadata result.
          const scores = await classifyImage(blob);
          if (scores) mergeModelScores(analysis, scores, tasks);
        } catch (modelError) {
          console.warn('[Guard] Local model inference failed:', modelError);
        }
      }

      // Only surface categories the user still has enabled.
      const categories: ImageAnalysisResult['categories'] = {};
      for (const category of Object.keys(analysis.categories) as DetectionCategory[]) {
        if (tasks[category]) categories[category] = analysis.categories[category];
      }

      finalResults.push({ status: 'success', src: analysis.src, categories });
    } catch (error) {
      console.warn('[Guard] candidate analysis failed:', candidate.src, error);
      finalResults.push({
        status: 'error',
        src: candidate.src,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return finalResults;
}
