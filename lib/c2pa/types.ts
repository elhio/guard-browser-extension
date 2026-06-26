import type { ImageCandidate } from '../images/types';

export interface C2paReadSuccess {
  status: 'success';
  candidate: ImageCandidate;
  /** Manifest store as returned by c2pa-web; null when the asset has no C2PA data. */
  manifestStore: unknown;
}

export interface C2paReadError {
  status: 'error';
  candidate: ImageCandidate;
  error: string;
}

export type C2paReadResult = C2paReadSuccess | C2paReadError;
