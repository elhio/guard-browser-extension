declare const chrome: any;

import { AVAILABLE_MODELS, ClientMessage, LogEntry, ModelState, ServerMessage } from './_types/types';

// Global background state
let currentState: ModelState = {
  status: 'idle',
  progress: 0,
  loadedModelId: null,
  allocatedMemoryMB: 0
};

let logs: LogEntry[] = [
  {
    timestamp: new Date().toLocaleTimeString(),
    text: 'Model runner backend initialized and listening.',
    type: 'info'
  }
];

// Reference to hold memory allocation
let activePorts = new Set<any>();

// Helper to push logs and notify all active ports
function addLog(text: any, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const textStr = typeof text === 'object' ? JSON.stringify(text) : String(text);
  const log: LogEntry = {
    timestamp: new Date().toLocaleTimeString(),
    text: textStr,
    type
  };
  logs.push(log);
  // Cap logs at 100 entries to prevent memory growth
  if (logs.length > 100) {
    logs.shift();
  }
  
  // Notify ports
  broadcast({ type: 'LOG_UPDATE', log });
}

function broadcast(message: ServerMessage) {
  activePorts.forEach(port => {
    try {
      port.postMessage(message);
    } catch (e) {
      activePorts.delete(port);
    }
  });
}

async function isOffscreenOpen(): Promise<boolean> {
  try {
    if (typeof chrome.runtime.getContexts === 'function') {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT' as any]
      });
      return contexts.length > 0;
    }
  } catch (e) {}
  return false;
}

async function restoreState() {
  try {
    const result = await browser.storage.local.get(['currentState']);
    if (result && result.currentState) {
      currentState = result.currentState as ModelState;
    }
  } catch (e) {}

  // Transient states (downloading, loading) should be reset on background startup/reconnect
  // because if the service worker restarted, the previous async load task was aborted.
  if (currentState.status === 'downloading' || currentState.status === 'loading') {
    currentState = {
      status: 'idle',
      progress: 0,
      loadedModelId: null,
      allocatedMemoryMB: 0
    };
    try {
      await browser.storage.local.set({ currentState });
    } catch (e) {}
  }

  // Verify if offscreen is actually open
  const isOpen = await isOffscreenOpen();
  if (!isOpen && currentState.status === 'loaded') {
    currentState = {
      status: 'idle',
      progress: 0,
      loadedModelId: null,
      allocatedMemoryMB: 0
    };
    try {
      await browser.storage.local.set({ currentState });
    } catch (e) {}
  }
}

function updateState(newState: Partial<ModelState>) {
  currentState = { ...currentState, ...newState };
  broadcast({ type: 'STATUS_UPDATE', status: currentState, logs });
  try {
    browser.storage.local.set({ currentState });
  } catch (e) {}
}

let creatingOffscreen: Promise<void> | null = null;

async function setupOffscreen() {
  const offscreenUrl = browser.runtime.getURL('/offscreen.html');

  try {
    if (typeof chrome.runtime.getContexts === 'function') {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT' as any]
      });
      if (contexts.length > 0) {
        return;
      }
    }
  } catch (e) {}

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = new Promise<void>((resolve, reject) => {
    chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['LOCAL_STORAGE' as any],
      justification: 'Run heavy LLM models using WebGPU/WASM and store model cache in origin private file system or cache storage.'
    })
    .then(() => resolve())
    .catch((err: any) => {
      if (err.message && err.message.includes('Only one offscreen document')) {
        resolve();
      } else {
        reject(err);
      }
    });
  });

  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

async function closeOffscreen() {
  try {
    if (typeof chrome.runtime.getContexts === 'function') {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT' as any]
      });
      if (contexts.length === 0) {
        return;
      }
    }
  } catch (e) {}

  try {
    await chrome.offscreen.closeDocument();
  } catch (e) {}
}

export default defineBackground(() => {
  console.log('Background Service Worker initialized.', { id: browser.runtime.id });

  // Listen to messages from offscreen
  chrome.runtime.onMessage.addListener((message: any) => {
    if (message.target !== 'background') return;

    switch (message.type) {
      case 'OFFSCREEN_LOG':
        addLog(message.logText, message.logType);
        break;
      case 'OFFSCREEN_STATUS':
        updateState(message.status);
        break;
      case 'OFFSCREEN_STREAM':
        broadcast({
          type: 'GENERATION_STREAM',
          token: message.token,
          text: message.text,
          done: message.done,
          error: message.error
        });
        break;
      case 'OFFSCREEN_IMAGE_RESULT':
        broadcast({
          type: 'IMAGE_CLASSIFICATION_RESULT',
          results: message.results,
          done: message.done,
          error: message.error
        });
        break;
    }
  });

  browser.runtime.onConnect.addListener(async (port) => {
    if (port.name !== 'model-runner') return;

    activePorts.add(port);
    addLog(`Frontend-Verbindung hergestellt (Port: ${port.sender?.id || 'popup'}).`, 'info');

    await restoreState();

    // Immediately send current state and logs to the newly connected port
    port.postMessage({
      type: 'STATUS_UPDATE',
      status: currentState,
      logs
    });

    port.onMessage.addListener((message: ClientMessage) => {
      switch (message.type) {
        case 'GET_STATUS': {
          port.postMessage({
            type: 'STATUS_UPDATE',
            status: currentState,
            logs
          });
          break;
        }

        case 'LOAD_MODEL': {
          const modelId = message.modelId;
          const device = (message as any).device || 'auto';
          const hfToken = (message as any).hfToken || '';
          const model = AVAILABLE_MODELS.find(m => m.id === modelId);
          if (!model) {
            addLog(`Fehler: Modell ${modelId} nicht gefunden.`, 'error');
            updateState({ status: 'error', errorMsg: `Modell ${modelId} existiert nicht.` });
            return;
          }

          if (currentState.loadedModelId === modelId && currentState.status === 'loaded') {
            addLog(`Modell ${model.name} ist bereits im RAM geladen.`, 'warning');
            return;
          }

          addLog(`Reales Modell ${model.name} wird geladen. Starten des Offscreen-Dokuments...`, 'info');
          setupOffscreen().then(() => {
            chrome.runtime.sendMessage({
              target: 'offscreen',
              type: 'LOAD_MODEL',
              modelId,
              device,
              hfToken
            });
          }).catch(err => {
            addLog(`Fehler beim Erstellen des Offscreen-Dokuments: ${err.message}`, 'error');
            updateState({ status: 'error', errorMsg: err.message });
          });
          break;
        }

        case 'UNLOAD_MODEL': {
          if (!currentState.loadedModelId) {
            addLog('Kein Modell zum Entladen vorhanden.', 'warning');
            return;
          }

          chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'UNLOAD_MODEL'
          });

          // After unloading, we close the offscreen document to release memory completely
          setTimeout(() => {
            closeOffscreen();
          }, 1000);
          break;
        }

        case 'GENERATE_TEXT': {
          if (currentState.status !== 'loaded' || !currentState.loadedModelId) {
            port.postMessage({
              type: 'GENERATION_STREAM',
              token: '',
              text: '',
              done: true,
              error: 'Es ist kein Modell im RAM geladen. Bitte wähle und lade ein Modell.'
            });
            addLog(`Generierungsversuch ohne geladenes Modell blockiert.`, 'warning');
            return;
          }

          chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'GENERATE_TEXT',
            prompt: message.prompt
          });
          break;
        }

        case 'CLASSIFY_IMAGE': {
          if (currentState.status !== 'loaded' || !currentState.loadedModelId) {
            port.postMessage({
              type: 'IMAGE_CLASSIFICATION_RESULT',
              results: [],
              done: true,
              error: 'Es ist kein Modell im RAM geladen.'
            });
            addLog(`Klassifizierungsversuch ohne geladenes Modell blockiert.`, 'warning');
            return;
          }

          chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'CLASSIFY_IMAGE',
            imageDataUrl: message.imageDataUrl
          });
          break;
        }

        case 'CLEAR_LOGS': {
          logs = [
            {
              timestamp: new Date().toLocaleTimeString(),
              text: 'System-Diagnostics (Log-Stream) gelöscht.',
              type: 'info'
            }
          ];
          broadcast({ type: 'STATUS_UPDATE', status: currentState, logs });
          break;
        }
      }
    });

    port.onDisconnect.addListener(() => {
      activePorts.delete(port);
      addLog('Frontend-Verbindung getrennt.', 'info');
    });
  });
});
