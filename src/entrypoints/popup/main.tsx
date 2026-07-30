import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.tsx';
import './style.css';

/**
 * iPhone/iPod only. iPadOS shows the popup as a macOS-style popover (not a full-screen sheet), so it
 * keeps the default fixed-width panel — it must NOT match here, or stripping the panel width leaves it
 * collapsed to WebKit's narrow default and unreadable.
 */
const isIPhone = () => /iP(hone|od)/.test(navigator.userAgent);

// iPhone Safari opens the toolbar popup as a full-screen sheet, not the content-sized panel the desktop
// layout is tuned for, so it leaves empty bands on the right and bottom. Flag <html> so the stylesheet
// can fill the viewport instead. macOS Safari and iPadOS keep the panel, so they must not match.
if (import.meta.env.SAFARI && isIPhone()) {
  document.documentElement.classList.add('ios-popup');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
