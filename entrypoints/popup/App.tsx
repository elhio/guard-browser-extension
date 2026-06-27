import { useEffect, useState, type FormEvent } from 'react';
import guardLogo from '@/assets/guard_logo.jpg';
import {
  addToWhitelist,
  getWhitelist,
  isBlurEnabled,
  isGuardEnabled,
  isHoverUnblurEnabled,
  normalizeHost,
  removeFromWhitelist,
  setBlurEnabled,
  setGuardEnabled,
  setHoverUnblurEnabled
} from '@/lib/settings';
import './App.css';

function App() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [blurEnabled, setBlurEnabledState] = useState<boolean | null>(null);
  const [hoverUnblurEnabled, setHoverUnblurEnabledState] = useState<boolean | null>(null);
  const [whitelist, setWhitelistState] = useState<string[] | null>(null);
  const [newHost, setNewHost] = useState('');
  const [currentHost, setCurrentHost] = useState<string | null>(null);

  useEffect(() => {
    void isGuardEnabled().then(setEnabled);
    void isBlurEnabled().then(setBlurEnabledState);
    void isHoverUnblurEnabled().then(setHoverUnblurEnabledState);
    void getWhitelist().then(setWhitelistState);
    void browser.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => setCurrentHost(tab?.url ? normalizeHost(tab.url) : null))
      .catch(() => setCurrentHost(null));
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

  async function toggleHoverUnblurEnabled(): Promise<void> {
    const next = !hoverUnblurEnabled;
    setHoverUnblurEnabledState(next);
    await setHoverUnblurEnabled(next);
  }

  async function handleAddHost(host: string): Promise<void> {
    const normalized = normalizeHost(host);
    if (!normalized) return;
    await addToWhitelist(normalized);
    setWhitelistState(await getWhitelist());
  }

  async function handleAddSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    await handleAddHost(newHost);
    setNewHost('');
  }

  async function handleRemoveHost(host: string): Promise<void> {
    await removeFromWhitelist(host);
    setWhitelistState(await getWhitelist());
  }

  const currentHostWhitelisted = currentHost !== null && (whitelist?.includes(currentHost) ?? false);

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

        <label className="toggle-row">
          <span className="toggle-label">Beim Hover scharf stellen</span>
          <button
            type="button"
            role="switch"
            aria-checked={hoverUnblurEnabled ?? false}
            className={`toggle-switch ${hoverUnblurEnabled ? 'on' : 'off'}`}
            onClick={toggleHoverUnblurEnabled}
            disabled={hoverUnblurEnabled === null || !blurEnabled}
          >
            <span className="toggle-knob" />
          </button>
        </label>
      </div>

      <div className="whitelist-section">
        <h2 className="section-title">Ausnahmen</h2>
        <p className="section-hint">Bilder auf diesen Seiten werden nicht geprüft.</p>

        {currentHost && (
          <button
            type="button"
            className="add-current-site"
            onClick={() => void handleAddHost(currentHost)}
            disabled={currentHostWhitelisted}
          >
            {currentHostWhitelisted ? `${currentHost} ist ausgenommen` : `${currentHost} ausnehmen`}
          </button>
        )}

        <form className="whitelist-add" onSubmit={(event) => void handleAddSubmit(event)}>
          <input
            type="text"
            className="whitelist-input"
            placeholder="example.com"
            value={newHost}
            onChange={(event) => setNewHost(event.target.value)}
          />
          <button type="submit" className="whitelist-add-button" disabled={!newHost.trim()}>
            +
          </button>
        </form>

        <ul className="whitelist-list">
          {whitelist?.map((host) => (
            <li key={host} className="whitelist-item">
              <span className="whitelist-host">{host}</span>
              <button
                type="button"
                className="whitelist-remove"
                onClick={() => void handleRemoveHost(host)}
                aria-label={`${host} entfernen`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
