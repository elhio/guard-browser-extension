import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

interface SettingsDashboardProps {
  onReset: () => void;
}

export default function SettingsDashboard({ onReset }: SettingsDashboardProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [detectionAction, setDetectionAction] = useState('indicate');
  const [defaultModel, setDefaultModel] = useState('local_onnx');

  // Load preferences when dashboard mounts
  useEffect(() => {
    browser.storage.local.get(['isLoggedIn', 'detectionAction', 'defaultModel']).then((res) => {
      if (res.isLoggedIn !== undefined) setIsLoggedIn(res.isLoggedIn);
      if (res.detectionAction !== undefined) setDetectionAction(res.detectionAction);
      if (res.defaultModel !== undefined) setDefaultModel(res.defaultModel);
    });
  }, []);

  // Sync actions back to browser storage on change
  const handleActionChange = async (action: string) => {
    setDetectionAction(action);
    await browser.storage.local.set({ detectionAction: action });
  };

  const handleModelChange = async (model: string) => {
    setDefaultModel(model);
    await browser.storage.local.set({ defaultModel: model });
  };

  const handleReset = async () => {
    await browser.storage.local.set({ hasCompletedSetup: false });
    onReset();
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, color: '#111' }}>AI Guard Dashboard</h1>
          <p style={{ margin: '5px 0 0 0', color: '#666' }}>Manage your extension configurations and scanning behavior.</p>
        </div>
        <span style={{ padding: '6px 12px', backgroundColor: isLoggedIn ? '#e6f4ea' : '#f1f3f4', color: isLoggedIn ? '#137333' : '#5f6368', borderRadius: '16px', fontSize: '14px', fontWeight: 'bold' }}>
          {isLoggedIn ? '● Logged In' : '○ Local Mode'}
        </span>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Preference Card 1: Handling Actions */}
        <section style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0 }}>On-Page Guard Actions</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>Determine the browser UI response policy for automated detections.</p>
          <select value={detectionAction} onChange={(e) => handleActionChange(e.target.value)} style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', minWidth: '200px' }}>
            <option value="indicate">Indicate (Badge Overlay)</option>
            <option value="blur">Blur (Hover to Reveal)</option>
            <option value="hide">Hide (Remove Layout)</option>
          </select>
        </section>

        {/* Preference Card 2: Engine Selection */}
        <section style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0 }}>Deep Scan Model Engine</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>Choose the default model target for explicit image deep inspections.</p>
          <select value={defaultModel} onChange={(e) => handleModelChange(e.target.value)} style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', minWidth: '200px' }}>
            <option value="local_onnx">Local ONNX Runtime</option>
            <option value="external_api">External Cloud Endpoint</option>
          </select>
        </section>

        {/* System Administration Card */}
        <section style={{ marginTop: '40px', padding: '20px', backgroundColor: '#fcfcfc', border: '1px dashed #ccc', borderRadius: '8px' }}>
          <h4 style={{ marginTop: 0, color: '#c0392b' }}>Developer Controls</h4>
          <p style={{ color: '#666', fontSize: '13px' }}>Clear persistent state records to force rerun the one-time welcome system configuration setup sequence.</p>
          <button onClick={handleReset} style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #c0392b', backgroundColor: '#fff', color: '#c0392b', cursor: 'pointer', fontWeight: 'bold' }}>
            Reset Setup Wizard
          </button>
        </section>
      </main>
    </div>
  );
}