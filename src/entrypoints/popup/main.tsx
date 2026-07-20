import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.tsx';
import './style.css';

/** iPhone/iPod, plus iPadOS (which reports as desktop Safari but exposes touch). */
const isIOS = () =>
  /iP(hone|od|ad)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// iOS Safari opens the toolbar popup as a full-screen sheet, not the content-sized panel the desktop
// layout is tuned for, so it leaves empty bands on the right and bottom. Flag <html> so the stylesheet
// can fill the viewport instead. macOS Safari keeps the panel, so it must not match.
if (import.meta.env.SAFARI && isIOS()) {
  document.documentElement.classList.add('ios-popup');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
