import type { ClassifyImageResult } from '@/lib/messaging/classifyMessages';
import type { VerifyImageData, VerifyImageResponse } from '@/lib/messaging/verifyMessages';
import type { TasksState } from '@/lib/detection';
import type { DetectionAction } from '@/lib/settings';

/** Visual status of a per-image badge ring (also drives the menu's loading/error chrome). */
export type RingStatus = 'processing' | 'idle' | 'alert' | 'error';

type SuccessResult = Extract<ClassifyImageResult, { status: 'success' }>;

export interface VerifyStateInfo {
  state: 'idle' | 'pending' | 'done' | 'error';
  data?: VerifyImageData;
  error?: string;
}

export interface OverlayEntry {
  src: string;
  element: HTMLImageElement;
  status: RingStatus;
  result?: SuccessResult;
  errorMessage?: string;
  verify: VerifyStateInfo;
}

/** Anchor geometry (viewport coordinates) for positioning the menu near a clicked ring. */
export interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface OpenTarget {
  src: string;
  anchor: AnchorRect;
}

/** The snapshot of extension settings the menu needs to decide its actions. */
export interface OverlaySettings {
  tasks: TasksState;
  token: string | null;
  verificatorSpace: string | null;
  detectionAction: DetectionAction;
}

/** The immutable view the React menu reads via `useSyncExternalStore`. */
export interface MenuSnapshot {
  openTarget: OpenTarget | null;
  entry: OverlayEntry | null;
  settings: OverlaySettings;
}

const entries = new Map<string, OverlayEntry>();
let openTarget: OpenTarget | null = null;
let settings: OverlaySettings = {
  tasks: { aiGenerated: true, violent: true, explicit: true },
  token: null,
  verificatorSpace: null,
  detectionAction: 'mark',
};
let verifyTransport: ((src: string) => Promise<VerifyImageResponse>) | null = null;

const listeners = new Set<() => void>();
let snapshot: MenuSnapshot = computeSnapshot();

function computeSnapshot(): MenuSnapshot {
  return {
    openTarget,
    entry: openTarget ? entries.get(openTarget.src) ?? null : null,
    settings,
  };
}

/** Rebuilds the cached snapshot (new reference) and notifies subscribers. */
function emit(): void {
  snapshot = computeSnapshot();
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): MenuSnapshot {
  return snapshot;
}

function ensureEntry(src: string, element: HTMLImageElement): OverlayEntry {
  const existing = entries.get(src);
  if (existing) {
    existing.element = element;
    return existing;
  }
  const entry: OverlayEntry = { src, element, status: 'processing', verify: { state: 'idle' } };
  entries.set(src, entry);
  return entry;
}

// ---- Content-script facing setters ----

export function markProcessing(src: string, element: HTMLImageElement): void {
  const entry = ensureEntry(src, element);
  entry.status = 'processing';
  entry.result = undefined;
  entry.errorMessage = undefined;
  entry.verify = { state: 'idle' };
  emit();
}

export function setResult(src: string, element: HTMLImageElement, result: SuccessResult, isAlert: boolean): void {
  const entry = ensureEntry(src, element);
  entry.status = isAlert ? 'alert' : 'idle';
  entry.result = result;
  entry.errorMessage = undefined;
  emit();
}

export function setErrorState(src: string, element: HTMLImageElement, message: string): void {
  const entry = ensureEntry(src, element);
  entry.status = 'error';
  entry.errorMessage = message;
  emit();
}

export function updateSettings(next: OverlaySettings): void {
  settings = next;
  emit();
}

export function setVerifyTransport(fn: (src: string) => Promise<VerifyImageResponse>): void {
  verifyTransport = fn;
}

/** Drops all tracked entries and closes the menu (page navigation / feature disabled). */
export function clearOverlayState(): void {
  entries.clear();
  openTarget = null;
  emit();
}

// ---- Menu facing actions ----

export function openMenu(src: string, anchor: AnchorRect): void {
  openTarget = { src, anchor };
  emit();
}

export function updateAnchor(src: string, anchor: AnchorRect): void {
  if (openTarget?.src === src) {
    openTarget = { src, anchor };
    emit();
  }
}

export function closeMenu(): void {
  if (openTarget) {
    openTarget = null;
    emit();
  }
}

/** Runs external verification for a src, driving the entry's verify state (single-flight). */
export async function runVerify(src: string): Promise<void> {
  const entry = entries.get(src);
  if (!entry || !verifyTransport || entry.verify.state === 'pending') return;

  entry.verify = { state: 'pending' };
  emit();

  try {
    const response = await verifyTransport(src);
    entry.verify = response.success
      ? { state: 'done', data: response.data }
      : { state: 'error', error: response.error };
  } catch (error) {
    entry.verify = { state: 'error', error: error instanceof Error ? error.message : String(error) };
  }
  emit();
}
