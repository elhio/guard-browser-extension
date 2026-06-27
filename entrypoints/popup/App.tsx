import { useEffect, useState } from 'react';
import guardLogo from '@/assets/guard_logo.jpg';
import { isBlurEnabled, isGuardEnabled, setBlurEnabled, setGuardEnabled } from '@/lib/settings';
import './App.css';

function App() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [blurEnabled, setBlurEnabledState] = useState<boolean | null>(null);

  useEffect(() => {
    void isGuardEnabled().then(setEnabled);
    void isBlurEnabled().then(setBlurEnabledState);
  }, []);

  async function toggleEnabled(): Promise<void> {
    const next = !enabled;
    setEnabled(next);
    await setGuardEnabled(next);
  }

  async function toggleBlurEnabled(): Promise<void> {
    const next = !blurEnabled;
    setBlurEnabledState(next);
    await setBlurEnabled(next);
  }

  return (
    <div className="popup">
      <img src={guardLogo} className="logo" alt="Guard logo" />
      <h1>GUARD</h1>
      <p className="subtitle">AI CONTENT DETECTOR</p>

      <div className="status-row">
        <span>Status:</span>
        <span className={`status-value ${enabled ? 'on' : 'off'}`}>
          {enabled === null ? '…' : enabled ? 'ACTIVE' : 'INACTIVE'}
        </span>
        <span className={`status-dot ${enabled ? 'on' : 'off'}`} />
      </div>

      <div className="toggle-list">
        <label className="toggle-row">
          <span className="toggle-label">Bild-Erkennung</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled ?? false}
            className={`toggle-switch ${enabled ? 'on' : 'off'}`}
            onClick={toggleEnabled}
            disabled={enabled === null}
          >
            <span className="toggle-knob" />
          </button>
        </label>

        <label className="toggle-row">
          <span className="toggle-label">KI-Bilder unscharf machen</span>
          <button
            type="button"
            role="switch"
            aria-checked={blurEnabled ?? false}
            className={`toggle-switch ${blurEnabled ? 'on' : 'off'}`}
            onClick={toggleBlurEnabled}
            disabled={blurEnabled === null}
          >
            <span className="toggle-knob" />
          </button>
        </label>
      </div>
    </div>
  );
}

export default App;
