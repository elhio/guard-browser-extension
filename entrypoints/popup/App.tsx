import { useState, useEffect, useRef } from 'react';
import { AVAILABLE_MODELS, LogEntry, ModelState, AIModel } from '../_types/types';
import './App.css';

// SVG Icons
const CPU_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="header-logo">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21M6.75 6.75h10.5a1.5 1.5 0 0 1 1.5 1.5v10.5a1.5 1.5 0 0 1-1.5 1.5H6.75a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5Zm1.875 3h7.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-7.5a1.125 1.125 0 0 1-1.125-1.125v-4.5c0-.621.504-1.125 1.125-1.125Z" />
  </svg>
);

const LOCK_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 24, height: 24 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
);

const CONSOLE_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="console-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
  </svg>
);

interface ChatMessage {
  sender: 'user' | 'model';
  text: string;
}

function App() {
  const [selectedModelId, setSelectedModelId] = useState<string>('qwen-0.5b');
  const [selectedDevice, setSelectedDevice] = useState<'auto' | 'webgpu' | 'cpu'>('auto');
  const [hfToken, setHfToken] = useState<string>('');
  const [modelState, setModelState] = useState<ModelState>({
    status: 'idle',
    progress: 0,
    loadedModelId: null,
    allocatedMemoryMB: 0
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Image Classification States
  const [currentImageUrl, setImageUrl] = useState<string | null>(null);
  const [classificationResults, setClassificationResults] = useState<Array<{ label: string; score: number }>>([]);
  const [isClassifying, setIsClassifying] = useState<boolean>(false);

  const portRef = useRef<any | null>(null);
  const consoleBottomRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load persisted states from browser storage on mount
  useEffect(() => {
    try {
      browser.storage.local.get([
        'selectedModelId',
        'selectedDevice',
        'chatHistory',
        'userInput',
        'currentImageUrl',
        'classificationResults'
      ]).then((result: any) => {
        if (result) {
          if (result.selectedModelId) setSelectedModelId(result.selectedModelId);
          if (result.selectedDevice) setSelectedDevice(result.selectedDevice);
          if (result.chatHistory) setChatHistory(result.chatHistory);
          if (result.userInput) setUserInput(result.userInput);
          if (result.currentImageUrl) setImageUrl(result.currentImageUrl);
          if (result.classificationResults) setClassificationResults(result.classificationResults);
        }
      });
    } catch (e) {}
  }, []);

  // Connect to extension background port
  useEffect(() => {
    const port = browser.runtime.connect({ name: 'model-runner' });
    portRef.current = port as any;

    port.onMessage.addListener((message: any) => {
      if (message.type === 'STATUS_UPDATE') {
        setModelState(message.status);
        setLogs(message.logs);
        // If current model in state is different, sync selection
        if (message.status.loadedModelId) {
          setSelectedModelId(message.status.loadedModelId);
        }
      } else if (message.type === 'LOG_UPDATE') {
        setLogs((prev) => [...prev, message.log].slice(-100)); // cap in state too
      } else if (message.type === 'GENERATION_STREAM') {
        if (message.error) {
          setChatHistory((prev) => [
            ...prev,
            { sender: 'model', text: `Fehler: ${message.error}` }
          ]);
          setIsGenerating(false);
          return;
        }

        setChatHistory((prev) => {
          if (prev.length === 0 || prev[prev.length - 1].sender === 'user') {
            // First token of the response
            return [...prev, { sender: 'model', text: message.text }];
          } else {
            // Update last model message
            const newHistory = [...prev];
            newHistory[newHistory.length - 1] = {
              sender: 'model',
              text: message.text
            };
            return newHistory;
          }
        });

        if (message.done) {
          setIsGenerating(false);
        }
      } else if (message.type === 'IMAGE_CLASSIFICATION_RESULT') {
        if (message.error) {
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              text: `Fehler bei Klassifizierung: ${message.error}`,
              type: 'error'
            }
          ]);
          setIsClassifying(false);
          return;
        }
        setClassificationResults(message.results);
        setIsClassifying(false);
      }
    });

    // Query status on load
    port.postMessage({ type: 'GET_STATUS' });

    return () => {
      port.disconnect();
    };
  }, []);

  // Persist states to browser storage on change
  useEffect(() => {
    try {
      browser.storage.local.set({ chatHistory });
    } catch (e) {}
  }, [chatHistory]);

  useEffect(() => {
    try {
      browser.storage.local.set({ userInput });
    } catch (e) {}
  }, [userInput]);

  useEffect(() => {
    try {
      browser.storage.local.set({ currentImageUrl });
    } catch (e) {}
  }, [currentImageUrl]);

  useEffect(() => {
    try {
      browser.storage.local.set({ classificationResults });
    } catch (e) {}
  }, [classificationResults]);

  useEffect(() => {
    try {
      browser.storage.local.set({ selectedModelId });
    } catch (e) {}
  }, [selectedModelId]);

  useEffect(() => {
    try {
      browser.storage.local.set({ selectedDevice });
    } catch (e) {}
  }, [selectedDevice]);

  // Auto-scroll logs
  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isGenerating]);

  // Load HF Token from storage
  useEffect(() => {
    try {
      browser.storage.local.get(['hfToken']).then((result: any) => {
        if (result && result.hfToken) {
          setHfToken(result.hfToken);
        }
      });
    } catch (e) {}
  }, []);

  const handleSaveToken = (val: string) => {
    setHfToken(val);
    try {
      browser.storage.local.set({ hfToken: val });
    } catch (e) {}
  };

  const handleSelectModel = (modelId: string) => {
    // Only allow selecting a different model if no model is currently loading or downloading
    if (modelState.status === 'downloading' || modelState.status === 'loading') {
      return;
    }
    setSelectedModelId(modelId);
  };

  const handleLoadModel = () => {
    if (modelState.status === 'downloading' || modelState.status === 'loading') return;
    
    portRef.current?.postMessage({
      type: 'LOAD_MODEL',
      modelId: selectedModelId,
      device: selectedDevice,
      hfToken: hfToken
    });
  };

  const handleUnloadModel = () => {
    portRef.current?.postMessage({
      type: 'UNLOAD_MODEL'
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageUrl(dataUrl);
      setClassificationResults([]);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageUrl(dataUrl);
      setClassificationResults([]);
    };
    reader.readAsDataURL(file);
  };

  const handleClassifyImage = () => {
    if (!currentImageUrl || isClassifying || modelState.status !== 'loaded') return;

    setIsClassifying(true);
    portRef.current?.postMessage({
      type: 'CLASSIFY_IMAGE',
      imageDataUrl: currentImageUrl
    });
  };

  const handleClearImage = () => {
    setImageUrl(null);
    setClassificationResults([]);
  };

  const handleSendPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isGenerating || modelState.status !== 'loaded') return;

    const prompt = userInput;
    setUserInput('');
    setIsGenerating(true);

    // Append user message immediately
    setChatHistory((prev) => [...prev, { sender: 'user', text: prompt }]);

    // Trigger generation via background API
    portRef.current?.postMessage({
      type: 'GENERATE_TEXT',
      prompt
    });
  };

  const handleClearLogs = () => {
    portRef.current?.postMessage({ type: 'CLEAR_LOGS' });
  };

  // Memory Telemetry Math
  const systemBaseRAM = 6400; // Simulated constant system RAM in MB (6.4 GB)
  const totalSystemRAM = 16384; // Simulated 16 GB RAM (16384 MB)
  const modelRAM = modelState.allocatedMemoryMB;
  const freeRAM = totalSystemRAM - (systemBaseRAM + modelRAM);

  const basePercent = (systemBaseRAM / totalSystemRAM) * 100;
  const modelPercent = (modelRAM / totalSystemRAM) * 100;

  const currentSelectedModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId);
  const isSelectedModelLoaded = modelState.loadedModelId === selectedModelId && modelState.status === 'loaded';
  const loadedModel = AVAILABLE_MODELS.find(m => m.id === modelState.loadedModelId);
  const isImageMode = modelState.status === 'loaded' 
    ? (loadedModel?.type === 'image-classification')
    : (currentSelectedModel?.type === 'image-classification');

  const aiDetectorIds = ['sdxl-detector', 'smogy-detector', 'vit-ai-detector', 'lens-light'];
  const isAiDetector = modelState.status === 'loaded'
    ? aiDetectorIds.includes(modelState.loadedModelId || '')
    : aiDetectorIds.includes(selectedModelId);

  // Support label schemes: 'artificial'/'human' (SDXL/SMOGY), 'FAKE'/'REAL' (ViT), and '🤖 KI-Generiert (AI)' (Lens Light)
  const artificialResult = classificationResults.find(r => {
    const lbl = r.label.toLowerCase();
    return lbl.includes('artificial') || lbl.includes('fake') || lbl.includes('ki-generiert') || lbl.includes('(ai)');
  });
  const humanResult = classificationResults.find(r => {
    const lbl = r.label.toLowerCase();
    return lbl.includes('human') || lbl.includes('real');
  });
  const artificialScore = artificialResult ? artificialResult.score : 0;
  const humanScore = humanResult ? humanResult.score : (artificialResult ? (1 - artificialResult.score) : 0);
  const isAIImage = artificialScore > 0.5;

  // Custom renderer for code blocks and inline code
  const renderMessageText = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        // Check if first line is a language tag
        let codeLines = lines;
        const possibleLanguage = lines[0].toLowerCase();
        const languages = ['typescript', 'javascript', 'js', 'ts', 'python', 'py', 'json', 'css', 'html'];
        if (languages.includes(possibleLanguage)) {
          codeLines = lines.slice(1);
        }
        
        return (
          <pre key={idx}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
      }
      
      // Inline code support
      const inlineParts = part.split(/(`[^`\n]+`)/g);
      return (
        <span key={idx}>
          {inlineParts.map((sub, sIdx) => {
            if (sub.startsWith('`') && sub.endsWith('`')) {
              return <code key={sIdx}>{sub.slice(1, -1)}</code>;
            }
            // Simple markdown-style bold support
            const boldParts = sub.split(/(\*\*[^*]+\*\*)/g);
            return boldParts.map((boldText, bIdx) => {
              if (boldText.startsWith('**') && boldText.endsWith('**')) {
                return <strong key={bIdx}>{boldText.slice(2, -2)}</strong>;
              }
              return boldText;
            });
          })}
        </span>
      );
    });
  };

  return (
    <div className="app-container">
      {/* Header Section */}
      <header className="app-header">
        <div className="header-title-container">
          {CPU_ICON}
          <h1 className="header-title">RAM Model Loader API</h1>
          <span className="header-subtitle">v1.0.0</span>
        </div>
        
        <div className="status-pill">
          <span className={`status-dot ${modelState.status}`}></span>
          <span>
            {modelState.status === 'idle' && 'Kein Modell geladen'}
            {modelState.status === 'downloading' && `Herunterladen... (${modelState.progress}%)`}
            {modelState.status === 'loading' && `RAM Zuweisung... (${modelState.progress}%)`}
            {modelState.status === 'loaded' && 'Modell Aktiv'}
            {modelState.status === 'error' && 'Fehler'}
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left Control Panel */}
        <aside className="left-panel">
          <div>
            <h2 className="panel-section-title">Modelle im System</h2>
            <div className="models-list">
              {AVAILABLE_MODELS.map((model) => {
                const isLoaded = modelState.loadedModelId === model.id && modelState.status === 'loaded';
                const isSelected = selectedModelId === model.id;
                
                return (
                  <div
                    key={model.id}
                    onClick={() => handleSelectModel(model.id)}
                    className={`model-card ${isSelected ? 'selected' : ''} ${isLoaded ? 'loaded' : ''}`}
                  >
                    <div className="model-card-header">
                      <h3 className="model-name">{model.name}</h3>
                      <span className="model-badge param">{model.parameterCount}</span>
                    </div>
                    <p className="model-desc">{model.description}</p>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <span className="model-badge ram-size">{model.ramMB} MB RAM</span>
                      <span className="model-badge">File: {(model.sizeMB / 1024).toFixed(1)} GB</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Trigger Box */}
          <div className="action-box">
            <h2 className="panel-section-title">RAM Schnittstelle</h2>
            
            {modelState.status === 'idle' && (
              <>
                <div className="device-selector-container" style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Inferenz-Hardware:
                  </label>
                  <select
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      fontSize: '12px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="auto">Automatisch (WebGPU / CPU Fallback)</option>
                    <option value="webgpu">WebGPU (Grafikkarte - Sehr Schnell)</option>
                    <option value="cpu">WASM (Prozessor / CPU - Sicherer Fallback)</option>
                  </select>
                </div>
                <button 
                  onClick={handleLoadModel} 
                  className="load-btn load"
                  disabled={!currentSelectedModel}
                >
                  In RAM laden ({currentSelectedModel?.ramMB} MB)
                </button>
              </>
            )}

            {(modelState.status === 'downloading' || modelState.status === 'loading') && (
              <div className="progress-bar-container">
                <div className="progress-info">
                  <span>{modelState.status === 'downloading' ? 'Lade Gewichte...' : 'Zuweisung...'}</span>
                  <span>{modelState.progress}%</span>
                </div>
                <div className="progress-track">
                  <div 
                    className={`progress-fill ${modelState.status === 'loading' ? 'loading' : ''}`} 
                    style={{ width: `${modelState.progress}%` }}
                  />
                </div>
              </div>
            )}

            {modelState.status === 'loaded' && (
              <button 
                onClick={handleUnloadModel} 
                className="load-btn unload"
              >
                Modell entladen
              </button>
            )}

            {modelState.status === 'error' && (
              <div>
                <p style={{ color: 'var(--accent-red)', fontSize: '11px', margin: '0 0 6px 0' }}>
                  {modelState.errorMsg || 'Fehler beim Laden.'}
                </p>
                <button onClick={handleLoadModel} className="load-btn load">
                  Erneut versuchen
                </button>
              </div>
            )}
          </div>

          {/* Hugging Face Access Token Input */}
          <div className="action-box" style={{ marginTop: '12px' }}>
            <h2 className="panel-section-title">Hugging Face Token</h2>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: '1.3' }}>
              Wird für geschützte Modelle (Llama, Gemma) benötigt. Melde dich bei HF an, akzeptiere die Modelllizenz und gib einen Lese-Token ein. Qwen & Phi-3 benötigen keinen Token.
            </p>
            <input
              type="password"
              placeholder="hf_..."
              value={hfToken}
              onChange={(e) => handleSaveToken(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                fontSize: '11px',
                outline: 'none'
              }}
            />
          </div>

          {/* Diagnostics Telemetry */}
          <div className="telemetry-box">
            <h2 className="panel-section-title">RAM Telemetrie (16 GB Gesamt)</h2>
            <div className="telemetry-row">
              <span className="telemetry-label">Grundlast System:</span>
              <span className="telemetry-val">{(systemBaseRAM / 1024).toFixed(2)} GB</span>
            </div>
            <div className="telemetry-row">
              <span className="telemetry-label">KI-Modell im RAM:</span>
              <span className="telemetry-val">{(modelRAM / 1024).toFixed(2)} GB</span>
            </div>
            <div className="telemetry-row">
              <span className="telemetry-label">Freier Speicher:</span>
              <span className="telemetry-val" style={{ color: freeRAM < 1500 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                {(freeRAM / 1024).toFixed(2)} GB
              </span>
            </div>

            <div className="ram-bar-container">
              <div className="ram-bar-used-base" style={{ width: `${basePercent}%` }} />
              <div className="ram-bar-used-model" style={{ width: `${modelPercent}%` }} />
              <div className="ram-bar-free" />
            </div>

            <div className="ram-legend">
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: '#4b5563' }}></span>
                <span>System</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: 'var(--accent-blue)' }}></span>
                <span>KI-RAM</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: 'var(--bg-tertiary)' }}></span>
                <span>Frei</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Chat and Console Area */}
        <main className="right-panel">
          {/* Conditionally render Chat or Image Classifier */}
          {isImageMode ? (
            <section className="image-classification-view">
              {modelState.status !== 'loaded' && (
                <div className="chat-lock-overlay">
                  <div className="lock-icon-container">
                    {LOCK_ICON}
                  </div>
                  <h3 className="lock-title">Schnittstelle gesperrt</h3>
                  <p className="lock-desc">
                    Lade zuerst ein Modell zur Bildklassifizierung (z.B. MobileNet-V2) in den RAM der Extension.
                  </p>
                </div>
              )}

              <div className="image-classifier-container">
                {!currentImageUrl ? (
                  <div 
                    className="upload-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="upload-icon">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.9 2.9m-18 8.25h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <p className="upload-text">Bild auswählen oder per Drag & Drop hierher ziehen</p>
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="file-input-hidden"
                    />
                  </div>
                ) : (
                  <div className="uploaded-image-preview-container">
                    <div className="preview-image-wrapper">
                      <img src={currentImageUrl} alt="Vorschau" className="preview-image" />
                      <button onClick={handleClearImage} className="clear-image-btn" disabled={isClassifying}>
                        Entfernen
                      </button>
                    </div>

                    <div className="classification-actions">
                      <button
                        onClick={handleClassifyImage}
                        disabled={isClassifying || modelState.status !== 'loaded'}
                        className="classify-btn"
                      >
                        {isClassifying ? 'Analysiere Bild...' : 'Bild lokal klassifizieren'}
                      </button>
                    </div>
                    
                    {isClassifying && (
                      <div className="typing-indicator" style={{ marginTop: '12px', width: '100%', boxSizing: 'border-box' }}>
                        <span className="typing-label">Modell führt Bildanalyse durch</span>
                        <div className="typing-dots">
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                        </div>
                      </div>
                    )}

                    {classificationResults.length > 0 && !isClassifying && (
                      <div className="results-panel">
                        {isAiDetector && (
                          <div className={`verdict-badge ${isAIImage ? 'verdict-ai' : 'verdict-real'}`}>
                            {isAIImage 
                              ? `🤖 KI-GENERIERTES BILD (${(artificialScore * 100).toFixed(1)}% Konfidenz)`
                              : `📸 ECHTES BILD (${(humanScore * 100).toFixed(1)}% Konfidenz)`
                            }
                          </div>
                        )}
                        <h4 className="results-title">Ergebnisse der lokalen Analyse:</h4>
                        <div className="results-list">
                          {classificationResults.map((res, index) => {
                            const percent = (res.score * 100).toFixed(1);
                            return (
                              <div key={index} className="result-row">
                                <div className="result-label-bar">
                                  <span className="result-label">{res.label}</span>
                                  <span className="result-percent">{percent}%</span>
                                </div>
                                <div className="result-progress-track">
                                  <div className="result-progress-fill" style={{ width: `${percent}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="chat-section">
              {modelState.status !== 'loaded' && (
                <div className="chat-lock-overlay">
                  <div className="lock-icon-container">
                    {LOCK_ICON}
                  </div>
                  <h3 className="lock-title">Schnittstelle gesperrt</h3>
                  <p className="lock-desc">
                    Lade zuerst ein Modell in den Arbeitsspeicher (RAM) der Extension, um lokale Textgenerierung zu starten.
                  </p>
                </div>
              )}

              <div className="messages-container">
                {chatHistory.length === 0 ? (
                  <div className="chat-welcome-msg">
                    <p><strong>Lokale RAM-KI bereit</strong></p>
                    <p>Schreibe eine Nachricht. Die Inferenz findet zu 100% offline in deinem RAM statt.</p>
                  </div>
                ) : (
                  chatHistory.map((msg, index) => (
                    <div 
                      key={index} 
                      className={`message-bubble ${msg.sender}`}
                    >
                      {msg.sender === 'model' ? (
                        renderMessageText(msg.text)
                      ) : (
                        <span>{msg.text}</span>
                      )}
                    </div>
                  ))
                )}
                {isGenerating && (chatHistory.length === 0 || chatHistory[chatHistory.length - 1].sender === 'user') && (
                  <div className="message-bubble model" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                    <div className="typing-indicator">
                      <span className="typing-label">Modell denkt nach</span>
                      <div className="typing-dots">
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              <form onSubmit={handleSendPrompt} className="chat-input-bar">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  disabled={modelState.status !== 'loaded' || isGenerating}
                  placeholder={modelState.status === 'loaded' ? 'Frage das RAM-Modell...' : 'Bitte Modell laden...'}
                  className="chat-input"
                />
                <button 
                  type="submit" 
                  disabled={modelState.status !== 'loaded' || isGenerating || !userInput.trim()}
                  className="chat-send-btn"
                >
                  {isGenerating ? 'Generiert...' : 'Senden'}
                </button>
              </form>
            </section>
          )}

          {/* Console Logger */}
          <section className="console-section">
            <div className="console-header">
              <div className="console-title-container">
                {CONSOLE_ICON}
                <h3 className="console-title">System-Diagnostics (Log-Stream)</h3>
              </div>
              <button onClick={handleClearLogs} className="console-clear-btn">
                Clear
              </button>
            </div>
            <div className="console-log-area">
              {logs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Keine Einträge vorhanden.</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={`log-line ${log.type}`}>
                    <span className="log-time">[{log.timestamp}]</span>
                    <span className="log-text">{log.text}</span>
                  </div>
                ))
              )}
              <div ref={consoleBottomRef} />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
