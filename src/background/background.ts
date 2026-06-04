import type { ExtensionMessage, Settings } from '../shared/types';
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

const tabEditorFrames: Record<number, number> = {};

// Handle LLM requests (non-streaming)
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  const frameId = sender.frameId;

  if (message.action === 'MONACO_READY') {
    if (tabId && frameId !== undefined) {
      tabEditorFrames[tabId] = frameId;
      console.log(`[VibeScript Background] Registered Monaco frame ${frameId} for tab ${tabId}`);
    }
    return false;
  }

  if (message.action === 'INJECT_BRIDGE') {
    if (tabId) {
      const targetFrameId = frameId !== undefined ? frameId : 0;
      console.log(`[VibeScript Background] Injecting inject.js into tab ${tabId} frame ${targetFrameId} via scripting API`);
      chrome.scripting.executeScript({
        target: { tabId, frameIds: [targetFrameId] },
        world: 'MAIN',
        files: ['src/content/inject.js']
      }).then(() => {
        console.log(`[VibeScript Background] Successfully injected inject.js to tab ${tabId} frame ${targetFrameId}`);
      }).catch((err) => {
        console.error('[VibeScript Background] Failed to inject inject.js via scripting API:', err);
      });
    }
    return false;
  }

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

  if (message.action === 'REQUEST_COMPLETION') {
    const { prefix } = message.payload;
    chrome.storage.local.get(['vibescript_settings'], async (result) => {
      const settings = result.vibescript_settings as Settings | undefined;
      if (!settings) {
        sendResponse({ suggestion: '' });
        return;
      }

      const provider = settings.provider;
      const apiKey = settings.apiKeys?.[provider];
      const model = settings.models?.[provider];

      if (!apiKey || !model) {
        sendResponse({ suggestion: '' });
        return;
      }

      try {
        const completionMessages = [
          {
            role: 'user' as const,
            content: `You are an expert coder. Complete the following code at the end of the text. Do not explain, do not add comments, and do not repeat the code prefix. Return ONLY the code to complete.
Code prefix:
${prefix}`
          }
        ];
        const response = await callLLM(provider, apiKey, model, completionMessages, []);
        sendResponse({ suggestion: response.text });
      } catch (err) {
        console.error('[VibeScript Background] Completion failed:', err);
        sendResponse({ suggestion: '' });
      }
    });
    return true; // async
  }

  if (message.action === 'PING') {
    sendResponse({ action: 'PONG' });
    return false;
  }

  // Cross-frame messaging routing:
  // Forward editor-oriented messages from main frame to Monaco editor iframe,
  // and editor responses from Monaco editor iframe back to main frame (frameId 0).
  if (tabId && (message.source === 'vibescript-content' || message.source === 'vibescript-sidepanel')) {
    const editorFrameId = tabEditorFrames[tabId];

    if (frameId !== 0 && frameId === editorFrameId) {
      // Message from Monaco editor frame: Forward to main frame (0)
      chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch((err) => {
        console.warn('[VibeScript Background] Failed to forward to main frame:', err.message);
      });
    } else if (frameId === 0 || frameId === undefined) {
      // Message from main frame: Forward to Monaco editor frame
      if (editorFrameId !== undefined) {
        chrome.tabs.sendMessage(tabId, message, { frameId: editorFrameId }).catch((err) => {
          console.warn('[VibeScript Background] Failed to forward to Monaco editor frame:', err.message);
        });
      } else {
        // Fallback: Send to all frames
        console.log('[VibeScript Background] Editor frame not registered yet. Sending to all frames.');
      }
    }
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
