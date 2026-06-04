import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../sidepanel/App';
import { useUiStore } from '../sidepanel/stores/uiStore';
import { useEditorStore } from '../sidepanel/stores/editorStore';
import { useDiagnosticsStore } from '../sidepanel/stores/diagnosticsStore';
import type { ExtensionMessage } from '../shared/types';
import cssText from '../index.css?inline';

// Log content script load
useDiagnosticsStore.getState().addLog('[Content] Content script loaded. top=' + (window === window.top) + ' url=' + window.location.href);

// 1. Request background to inject the page-context bridge script (inject.js) via scripting API to bypass CSP
useDiagnosticsStore.getState().addLog('[Content] Requesting background to run INJECT_BRIDGE');
chrome.runtime.sendMessage({
  source: 'vibescript-content',
  action: 'INJECT_BRIDGE'
});

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

if (!host && window === window.top) {
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

// 4. Message Listener for Extension background toggles and cross-frame messages
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  useDiagnosticsStore.getState().addLog('[Content] Received runtime message: ' + message.action);

  if (message.action === 'SIDE_PANEL_OPENED') {
    if (window === window.top) {
      useUiStore.getState().togglePanel();
    }
    sendResponse({ success: true });
    return false;
  }

  // If we are in the main frame (frameId: 0), forward editor-produced values to the React UI or stores
  if (window === window.top) {
    if (message.action === 'ATTACH_SELECTION') {
      useDiagnosticsStore.getState().addLog('[Content] Forwarding ATTACH_SELECTION content to editor store', 'success');
      useEditorStore.getState().addAttachment({
        filename: message.payload.filename,
        content: message.payload.content || message.payload.text || '',
        lineStart: message.payload.startLine,
        lineEnd: message.payload.endLine
      });
      useUiStore.getState().insertMention(
        message.payload.filename,
        message.payload.startLine,
        message.payload.endLine
      );
      useUiStore.getState().setPanelOpen(true);
    } else if (
      message.action === 'CODE_RESULT' ||
      message.action === 'DIFF_RESULT' ||
      message.action === 'LIST_FILES_RESULT' ||
      message.action === 'EDIT_FILE_RESULT'
    ) {
      window.postMessage({
        ...message,
        source: 'vibescript-inject',
        fromContentScript: true
      }, '*');
    }
  }
  // If we are in the Monaco editor frame (nested iframe), forward editor commands down to the page context inject.js
  else {
    if (
      message.action === 'GET_CODE' ||
      message.action === 'SET_CODE' ||
      message.action === 'INSERT_AT_CURSOR' ||
      message.action === 'REPLACE_SELECTION' ||
      message.action === 'LIST_FILES' ||
      message.action === 'READ_FILE_BY_NAME' ||
      message.action === 'EDIT_FILE_REVIEW' ||
      message.action === 'EDIT_FILE_REVIEW_CANCEL' ||
      message.action === 'EDIT_FILE'
    ) {
      window.postMessage(message, '*');
    }
  }

  return false;
});

// 5. Message Listener for Monaco page-context (inject.js) communication
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  // Handles messages coming from the page-context (inject.js)
  if (data.source === 'vibescript-inject' && !data.fromContentScript) {
    const { action, payload } = data;

    if (action === 'DIAGNOSTICS_LOG') {
      useDiagnosticsStore.getState().addLog(`[Inject] ${payload.message}`, payload.type);
      return;
    }

    useDiagnosticsStore.getState().addLog(`[Content] Received from inject: ${action}`);

    if (action === 'REQUEST_COMPLETION') {
      chrome.runtime.sendMessage({
        source: 'vibescript-content',
        action: 'REQUEST_COMPLETION',
        payload
      }, (response) => {
        window.postMessage({
          source: 'vibescript-content',
          action: 'COMPLETION_RESULT',
          payload: {
            requestId: payload.requestId,
            suggestion: response?.suggestion || ''
          }
        }, '*');
      });
    } else {
      // Forward Monaco events/results (DIFF_RESULT, CODE_RESULT, etc.) up to background
      chrome.runtime.sendMessage({
        source: 'vibescript-content',
        action,
        payload
      }).catch((err) => {
        console.error('[VibeScript Content] Failed to forward ' + action + ' to background:', err.message);
      });
    }
  }

  // Intercept messages from the React app sidepanel and forward to the background script
  // so they can be routed to the correct editor frame.
  const sidepanelRequests = [
    'GET_CODE',
    'SET_CODE',
    'INSERT_AT_CURSOR',
    'REPLACE_SELECTION',
    'LIST_FILES',
    'READ_FILE_BY_NAME',
    'EDIT_FILE_REVIEW',
    'EDIT_FILE_REVIEW_CANCEL',
    'EDIT_FILE'
  ];
  if (data.source === 'vibescript-content' && window === window.top) {
    if (sidepanelRequests.includes(data.action)) {
      useDiagnosticsStore.getState().addLog('[Content] Forwarding sidepanel message to background: ' + data.action);
      chrome.runtime.sendMessage(data).catch((err) => {
        console.error('[VibeScript Content] Failed to forward ' + data.action + ' to background:', err.message);
      });
    }
  }
});
