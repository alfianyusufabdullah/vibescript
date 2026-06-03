import type { ExtensionMessage } from '../shared/types';
import { callLLM } from '../shared/llm';

// Toggle the offcanvas panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      source: 'vibescript-background',
      action: 'SIDE_PANEL_OPENED'
    }).catch((err) => {
      // Content script is not injected on non-matching pages
      console.log('[VibeScript] Content script not active on this tab:', err.message);
    });
  }
});

// Handle LLM requests and other background actions
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.action === 'LLM_REQUEST') {
    const { provider, apiKey, model, messages } = message.payload;
    
    // Call LLM asynchronously
    callLLM(provider, apiKey, model, messages)
      .then((response) => {
        sendResponse({ success: true, text: response });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message || String(err) });
      });
      
    return true; // Keeps the messaging channel open for asynchronous sendResponse
  }
  
  if (message.action === 'PING') {
    sendResponse({ action: 'PONG' });
    return false;
  }
});
