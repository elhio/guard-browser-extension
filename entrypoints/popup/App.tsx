import { useEffect, useState } from 'react';
import guardLogo from '@/assets/guard_logo.jpg';
import { isGuardEnabled, setGuardEnabled } from '@/lib/settings';
import './App.css';

function App() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    void isGuardEnabled().then(setEnabled);
  }, []);

  async function toggleEnabled(): Promise<void> {
    const next = !enabled;
    setEnabled(next);
    await setGuardEnabled(next);
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

      <button
        type="button"
        className={`toggle-button ${enabled ? 'on' : 'off'}`}
        onClick={toggleEnabled}
        disabled={enabled === null}
      >
        {enabled ? 'Bild-Erkennung deaktivieren' : 'Bild-Erkennung aktivieren'}
      </button>
    </div>
  );
}

export default App;
