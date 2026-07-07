import { browser } from 'wxt/browser';
import { readManifests } from '@/lib/c2pa';
import {
  isOffscreenClassifyImageRequest,
  type ClassifyImageResponse,
  type ClassifyImageResult
} from '@/lib/messaging/classifyMessages';
import type { ImageAnalysisResult } from '@/lib/detection/types';

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isOffscreenClassifyImageRequest(message)) {
    (async () => {
      try {
        const { candidates, tasks, useDetectorLocalModel } = message;

        // 1. Run Metadata / C2PA Extraction
        // Assuming readManifests has been updated to return an array of ImageAnalysisResult
        const baseResults: ImageAnalysisResult[] = await readManifests(candidates);

        // Map results by source URL for easy lookup
        const resultsMap = new Map<string, ImageAnalysisResult>(
          baseResults.map((res) => [res.src, res])
        );

        const finalResults: ClassifyImageResult[] = [];

        let classifyImageAiScore: ((src: string) => Promise<number | null>) | null = null;
        if (useDetectorLocalModel && tasks.aiGenerated) {
          const runner = await import('@/lib/localModel/runner');
          classifyImageAiScore = runner.classifyImageAiScore;
        }

        for (const candidate of candidates) {
          try {
            const analysis = resultsMap.get(candidate.src) || {
              src: candidate.src,
              categories: {}
            };

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
                  analysis.categories.aiGenerated.detected = modelPercent > 50;
                }
              }
            }

            finalResults.push({
              status: 'success',
              ...analysis
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