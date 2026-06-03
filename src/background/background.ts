import type { ExtensionMessage } from '../shared/types';
import { callLLM, callLLMStream } from '../shared/llm';

// Toggle the offcanvas panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      source: 'vibescript-background',
      action: 'SIDE_PANEL_OPENED'
    }).catch((err) => {
      console.log('[VibeScript] Content script not active on this tab:', err.message);
    });
  }
});

// Handle LLM requests (non-streaming)
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.action === 'LLM_REQUEST') {
    const { provider, apiKey, model, messages, tools } = message.payload;

    callLLM(provider, apiKey, model, messages, tools)
      .then((response) => {
        sendResponse({
          success: true,
          text: response.text,
          toolCalls: response.toolCalls,
          finishReason: response.finishReason,
          usage: response.usage
        });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message || String(err) });
      });

    return true;
  }

  if (message.action === 'PING') {
    sendResponse({ action: 'PONG' });
    return false;
  }
});

// Handle streaming LLM requests via port
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'llm-stream') return;

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'start') {
      const { provider, apiKey, model, messages, tools } = msg;

      try {
        await callLLMStream(provider, apiKey, model, messages, tools, {
          onText: (text: string) => port.postMessage({ type: 'text', text }),
          onDone: (text: string, toolCalls: any, usage: any) =>
            port.postMessage({ type: 'done', text, toolCalls, usage }),
          onError: (error: string) => port.postMessage({ type: 'error', error })
        });
      } catch (err: any) {
        port.postMessage({ type: 'error', error: err.message || String(err) });
      }
    }
  });
});
