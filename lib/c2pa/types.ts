import type { ManifestStore } from '@contentauth/c2pa-types';
import type { ImageCandidate } from '@/lib/images';
import type { AiDetectionResult } from './aiDetection/types';

export interface C2paReadSuccess {
  status: 'success';
  candidate: ImageCandidate;
  /** Manifest store as returned by c2pa-web; null when the asset has no C2PA data. */
  manifestStore: ManifestStore | null;
  /** Whether the active manifest (if any) shows hints of AI generation. */
  aiDetection: AiDetectionResult;
}

export interface C2paReadError {
  status: 'error';
  candidate: ImageCandidate;
  error: string;
}

export type C2paReadResult = C2paReadSuccess | C2paReadError;
