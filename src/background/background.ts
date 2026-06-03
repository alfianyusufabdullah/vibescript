import type { ExtensionMessage } from '../shared/types';
import { callLLM } from '../shared/llm';

// Set side panel behavior to open on action click
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Error setting panel behavior:', error));
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
