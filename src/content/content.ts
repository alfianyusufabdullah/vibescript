import type { ExtensionMessage } from '../shared/types';

// Inject page-context script (inject.js) to access window.monaco
try {
  const script = document.createElement('script');
  // CRXJS compiles src/content/inject.ts into src/content/inject.js in the output dist folder
  script.src = chrome.runtime.getURL('src/content/inject.js');
  script.onload = () => {
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
  console.log('[VibeScript] Content script injected bridge successfully');
} catch (err) {
  console.error('[VibeScript] Failed to inject bridge script:', err);
}

// Map to track asynchronous callbacks from side panel to page context
const pendingCallbacks = new Map<string, (response: any) => void>();

// Listen for messages from the Chrome Extension (Side Panel)
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.source !== 'vibescript-sidepanel') return false;

  const requestId = Math.random().toString(36).substring(7);

  // For read actions, we store the callback and wait for the page context response
  if (message.action === 'GET_CODE') {
    pendingCallbacks.set(requestId, (data) => {
      sendResponse(data);
    });

    // Send to injected page-context script
    window.postMessage({
      source: 'vibescript-content',
      action: 'GET_CODE',
      payload: { requestId }
    }, '*');

    return true; // Keep message channel open for asynchronous sendResponse
  }

  // Write actions are fire-and-forget for the page context, but we still send a quick success response
  if (
    message.action === 'SET_CODE' ||
    message.action === 'INSERT_AT_CURSOR' ||
    message.action === 'REPLACE_SELECTION'
  ) {
    window.postMessage({
      source: 'vibescript-content',
      action: message.action,
      payload: message.payload
    }, '*');
    sendResponse({ success: true });
    return false;
  }

  // Inline completion result returning from side panel back to injected script
  if (message.action === 'COMPLETION_RESULT') {
    window.postMessage({
      source: 'vibescript-content',
      action: 'COMPLETION_RESULT',
      payload: message.payload
    }, '*');
    sendResponse({ success: true });
    return false;
  }
});

// Listen for messages from the injected page-context script
window.addEventListener('message', (event) => {
  if (event.data?.source !== 'vibescript-inject') return;

  const { action, payload } = event.data;

  // If it's a code result for a pending GET_CODE request
  if (action === 'CODE_RESULT') {
    const { requestId, context } = payload || {};
    if (requestId && pendingCallbacks.has(requestId)) {
      const callback = pendingCallbacks.get(requestId);
      if (callback) {
        callback({ success: true, context });
        pendingCallbacks.delete(requestId);
      }
    }
  }

  // If the injected script requests an inline completion from the LLM
  if (action === 'REQUEST_COMPLETION') {
    // Send to the side panel
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
