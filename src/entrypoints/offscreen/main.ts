import { browser } from 'wxt/browser';
import { readManifestFor } from '@/lib/c2pa';
import {
  isOffscreenClassifyImageRequest,
  type ClassifyImageResponse,
  type ClassifyImageResult
} from '@/lib/messaging/classifyMessages';
import { passesThreshold, type DetectionCategory, type ImageAnalysisResult } from '@/lib/detection';

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isOffscreenClassifyImageRequest(message)) {
    (async () => {
      try {
        const { candidates, tasks, useDetectorLocalModel } = message;

        const finalResults: ClassifyImageResult[] = [];

        let classifyImageAiScore: ((src: string) => Promise<number | null>) | null = null;
        if (useDetectorLocalModel && tasks.aiGenerated) {
          const runner = await import('@/lib/localModel/runner');
          classifyImageAiScore = runner.classifyImageAiScore;
        }

        for (const candidate of candidates) {
          try {
            // Each candidate is analyzed independently: a fetch failure/timeout throws
            // and becomes this candidate's error result, without blocking the others.
            const analysis = await readManifestFor(candidate);

            if (classifyImageAiScore) {
              const score = await classifyImageAiScore(candidate.src);

              if (score !== null) {
                const modelPercent = Math.round(score * 100);

                if (!analysis.categories.aiGenerated) {
                  analysis.categories.aiGenerated = { detected: false, confidence: 0, matches: [] };
                }

                // Push the local model result as a new piece of evidence
                analysis.categories.aiGenerated.matches.push({
                  id: 'local-model-ai',
                  category: 'aiGenerated',
                  label: 'Local AI Model',
                  description: 'Inference result from the locally running on-device model',
                  confidence: modelPercent,
                  kind: score > 0.5 ? 'aiGenerated' : 'authentic',
                  evidence: `Model confidence score: ${modelPercent}%`
                });

                // Ensure the overall confidence reflects the highest signal found
                if (modelPercent > analysis.categories.aiGenerated.confidence) {
                  analysis.categories.aiGenerated.confidence = modelPercent;
                  analysis.categories.aiGenerated.detected = passesThreshold('aiGenerated', modelPercent);
                }
              }
            }

            // Only surface categories the user still has enabled.
            const categories: ImageAnalysisResult['categories'] = {};
            for (const category of Object.keys(analysis.categories) as DetectionCategory[]) {
              if (tasks[category]) categories[category] = analysis.categories[category];
            }

            finalResults.push({
              status: 'success',
              src: analysis.src,
              categories
            });

          } catch (error) {
            finalResults.push({
              status: 'error',
              src: candidate.src,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        sendResponse({ results: finalResults } satisfies ClassifyImageResponse);

      } catch (error) {
        console.error('[Offscreen] Classification Error:', error);

        sendResponse({
          results: message.candidates.map(c => ({
            status: 'error',
            src: c.src,
            error: error instanceof Error ? error.message : String(error)
          }))
        } satisfies ClassifyImageResponse);
      }
    })();
    return true;
  }

  return undefined;
});