import { useState, useEffect, useRef } from 'react';
import type { MLCEngine } from '@mlc-ai/web-llm';
import './App.css';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export default function App() {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadText, setLoadText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [tokensPerSec, setTokensPerSec] = useState<number | null>(null);

  const engineRef = useRef<MLCEngine | null>(null);
  const startTimeRef = useRef<number>(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  async function loadModel() {
    setLoadStatus('loading');
    setLoadProgress(0);
    setLoadText('Lade WebLLM...');

    try {
      // Dynamic import so WebLLM does not run at popup startup
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

      const engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          setLoadProgress(Math.round(report.progress * 100));
          setLoadText(report.text);
        },
      });

      engineRef.current = engine;
      setLoadStatus('ready');
    } catch (err) {
      console.error('WebLLM load error:', err);
      setLoadText(err instanceof Error ? err.message : String(err));
      setLoadStatus('error');
    }
  }

  async function handleSend() {
    const text = prompt.trim();
    if (!text || isGenerating || !engineRef.current) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const history: ChatMessage[] = [...messages, userMsg];

    setMessages(history);
    setPrompt('');
    setIsGenerating(true);
    setStreamingContent('');
    setTokensPerSec(null);
    startTimeRef.current = Date.now();

    try {
      const stream = await engineRef.current.chat.completions.create({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      });

      let fullText = '';
      let tokenCount = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        fullText += delta;
        tokenCount += delta.length > 0 ? 1 : 0;
        setStreamingContent(fullText);

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        if (elapsed > 0 && tokenCount > 0) {
          setTokensPerSec(Math.round(tokenCount / elapsed));
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fullText }]);
      setStreamingContent('');
    } catch (err) {
      console.error('Inference error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Fehler: ${err instanceof Error ? err.message : String(err)}` },
      ]);
      setStreamingContent('');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-icon">G</div>
        <div>
          <h1 className="header-title">Guard LLM</h1>
          <p className="header-subtitle">Llama 3.2 · lokal · WebGPU</p>
        </div>
        <div className={`status-dot ${loadStatus}`} title={loadStatus} />
      </header>

      {loadStatus === 'idle' && (
        <div className="section-box">
          <p className="model-name">{MODEL_ID}</p>
          <p className="model-desc">
            1B Parameter · 4-bit Quantisierung · ~0.7 GB
            <br />
            Einmalig herunterladen, danach vollstaendig offline via WebGPU.
          </p>
          <button className="btn-primary" onClick={loadModel}>
            Modell laden
          </button>
        </div>
      )}

      {loadStatus === 'loading' && (
        <div className="section-box">
          <p className="model-name">Lade {MODEL_ID}</p>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${loadProgress}%` }} />
          </div>
          <p className="progress-label">{loadProgress}%</p>
          <p className="progress-text">{loadText}</p>
        </div>
      )}

      {loadStatus === 'error' && (
        <div className="section-box">
          <p className="model-name error-text">Ladefehler</p>
          <p className="progress-text">{loadText}</p>
          <p className="model-desc">
            Benoetigt Chrome 113+ mit WebGPU-Unterstuetzung.
            <br />
            Popup-Konsole (F12) fuer Details pruefen.
          </p>
          <button className="btn-primary" onClick={loadModel}>
            Erneut versuchen
          </button>
        </div>
      )}

      {loadStatus === 'ready' && (
        <>
          <div className="chat-area">
            {messages.length === 0 && !streamingContent && (
              <div className="empty-state">
                <p>Modell bereit. Stellen Sie eine Frage.</p>
                <div className="suggestions">
                  {[
                    'Erklaere mir, wie WebGPU funktioniert.',
                    'Was ist der Unterschied zwischen LLM und SLM?',
                    'Wie schuetze ich meine Privatspaere im Browser?',
                  ].map((s) => (
                    <button key={s} className="suggestion-chip" onClick={() => setPrompt(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                <div className="message-bubble">{msg.content}</div>
              </div>
            ))}

            {streamingContent && (
              <div className="message assistant">
                <div className="message-bubble">
                  {streamingContent}
                  <span className="cursor" />
                </div>
              </div>
            )}

            {isGenerating && !streamingContent && (
              <div className="message assistant">
                <div className="message-bubble typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {tokensPerSec !== null && !isGenerating && (
            <p className="tps-bar">{tokensPerSec} tok/s · {MODEL_ID} · lokal</p>
          )}

          <div className="input-row">
            <textarea
              className="input-field"
              rows={2}
              placeholder="Nachricht eingeben... (Enter zum Senden)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
            />
            <button
              className="btn-send"
              onClick={handleSend}
              disabled={isGenerating || !prompt.trim()}
            >
              &#9658;
            </button>
          </div>
        </>
      )}
    </div>
  );
}
