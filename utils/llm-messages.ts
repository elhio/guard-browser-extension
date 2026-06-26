export type ModelStatus = 'idle' | 'downloading' | 'ready';

export interface ModelState {
  status: ModelStatus;
  progress: number; // 0-100
  modelName: string;
}

export type AppMessage =
  | { type: 'GET_STATUS' }
  | { type: 'DOWNLOAD_MODEL' }
  | { type: 'RUN_INFERENCE'; prompt: string };

export type AppMessageResponse =
  | { type: 'STATUS'; state: ModelState }
  | { type: 'INFERENCE_RESULT'; response: string; tokensPerSec: number }
  | { type: 'ERROR'; message: string };