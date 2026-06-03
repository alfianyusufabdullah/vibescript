import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../sidepanel/App';
import { useUiStore } from '../sidepanel/stores/uiStore';
import type { ExtensionMessage } from '../shared/types';
import cssText from '../index.css?inline';

// 1. Inject page-context script (inject.js) to access window.monaco
try {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/content/inject.js');
  script.onload = () => {
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
  console.log('[VibeScript] Content script injected bridge successfully');
} catch (err) {
  console.error('[VibeScript] Failed to inject bridge script:', err);
}

// 2. Load Google Fonts (Outfit) and Global Offcanvas Styles in main document head
const linkId = 'vibescript-google-fonts';
if (!document.getElementById(linkId)) {
  const preconnect1 = document.createElement('link');
  preconnect1.rel = 'preconnect';
  preconnect1.href = 'https://fonts.googleapis.com';
  document.head.appendChild(preconnect1);

  const preconnect2 = document.createElement('link');
  preconnect2.rel = 'preconnect';
  preconnect2.href = 'https://fonts.gstatic.com';
  preconnect2.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect2);

  const fontLink = document.createElement('link');
  fontLink.id = linkId;
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap';
  document.head.appendChild(fontLink);
}

const globalStyleElId = 'vibescript-global-styles';
if (!document.getElementById(globalStyleElId)) {
  const style = document.createElement('style');
  style.id = globalStyleElId;
  style.textContent = `
    .vibescript-ide-shrunk {
      right: 380px !important;
      width: calc(100% - 380px) !important;
    }
    .vibescript-ide-transition {
      transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1), width 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }
    body.vibescript-no-transition,
    body.vibescript-no-transition *,
    .vibescript-no-transition,
    .vibescript-no-transition * {
      transition: none !important;
    }
  `;
  document.head.appendChild(style);
}

// Add vibescript-no-transition immediately to prevent flash on load
document.body.classList.add('vibescript-no-transition');

// 3. Create Host & Mount React inside Shadow DOM
const rootId = 'vibescript-root';
let host = document.getElementById(rootId);

if (!host) {
  host = document.createElement('div');
  host.id = rootId;
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });

  // Inject CSS inside Shadow DOM
  const styleEl = document.createElement('style');
  styleEl.textContent = cssText;
  shadowRoot.appendChild(styleEl);

  // React App container
  const reactContainer = document.createElement('div');
  shadowRoot.appendChild(reactContainer);

  const root = createRoot(reactContainer);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// 4. Message Listener for Extension background toggles
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.action === 'SIDE_PANEL_OPENED') {
    useUiStore.getState().togglePanel();
    sendResponse({ success: true });
  }
  return false;
});

// 5. Message Listener for Monaco editor completions
window.addEventListener('message', (event) => {
  if (event.data?.source !== 'vibescript-inject') return;

  const { action, payload } = event.data;

  // If the injected script requests an inline completion from the LLM
  if (action === 'REQUEST_COMPLETION') {
    // Send to background service worker
    chrome.runtime.sendMessage({
      source: 'vibescript-content',
      action: 'REQUEST_COMPLETION',
      payload
    }, (response) => {
      // Forward the completion result back to the page context
      window.postMessage({
        source: 'vibescript-content',
        action: 'COMPLETION_RESULT',
        payload: {
          requestId: payload.requestId,
          suggestion: response?.suggestion || ''
        }
      }, '*');
    });
  }
});
