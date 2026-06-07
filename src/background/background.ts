import type { ExtensionMessage, Settings, AgentMessage, ToolDefinition } from '../shared/types';
import { providerRegistry } from '../shared/providers';
import { registerBuiltinTools } from '../shared/tools';

registerBuiltinTools();

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      source: 'vibescript-background',
      action: 'SIDE_PANEL_OPENED',
    }).catch((err) => {
      console.log('[VibeScript] Content script not active on this tab:', err.message);
    });
  }
});

const tabEditorFrames: Record<number, number> = {};

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
      chrome.scripting.executeScript({
        target: { tabId, frameIds: [targetFrameId] },
        world: 'MAIN',
        files: ['src/content/inject.js'],
      }).then(() => {
        console.log(`[VibeScript Background] Successfully injected inject.js to tab ${tabId} frame ${targetFrameId}`);
      }).catch((err) => {
        console.error('[VibeScript Background] Failed to inject inject.js via scripting API:', err);
      });
    }
    return false;
  }

  if (message.action === 'LLM_REQUEST') {
    const { provider, apiKey, model, messages, tools } = (message.payload ?? {}) as {
      provider: string; apiKey: string; model: string; messages: AgentMessage[]; tools: ToolDefinition[];
    };

    try {
      const providerInstance = providerRegistry.get(provider, { apiKey, model });
      providerInstance.generate({ model, messages, tools }, { apiKey, model })
        .then((response) => {
          sendResponse({
            success: true,
            text: response.text,
            toolCalls: response.toolCalls,
            finishReason: response.finishReason,
            usage: response.usage,
          });
        })
        .catch((err: Error) => {
          sendResponse({ success: false, error: err.message || String(err) });
        });
    } catch (err: unknown) {
      sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
    }

    return true;
  }

  if (message.action === 'REQUEST_COMPLETION') {
    const { prefix } = (message.payload ?? {}) as { prefix: string };
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
        const completionMessages: AgentMessage[] = [
          {
            role: 'user',
            content: `You are an expert coder. Complete the following code at the end of the text. Do not explain, do not add comments, and do not repeat the code prefix. Return ONLY the code to complete.
Code prefix:
${prefix}`,
          },
        ];
        const providerInstance = providerRegistry.get(provider, { apiKey, model });
        const response = await providerInstance.generate(
          { model, messages: completionMessages, tools: [] },
          { apiKey, model }
        );
        sendResponse({ suggestion: response.text });
      } catch (err) {
        console.error('[VibeScript Background] Completion failed:', err);
        sendResponse({ suggestion: '' });
      }
    });
    return true;
  }

  if (message.action === 'PING') {
    sendResponse({ action: 'PONG' });
    return false;
  }

  if (tabId && (message.source === 'vibescript-content' || message.source === 'vibescript-sidepanel')) {
    const editorFrameId = tabEditorFrames[tabId];

    if (frameId !== 0 && frameId === editorFrameId) {
      // From editor iframe → forward to main frame (0)
      chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch((err) => {
        console.warn('[VibeScript Background] Failed to forward to main frame:', err.message);
      });
    } else {
      // From main frame (0), unknown frame, or editor frame not registered
      // Forward to editor frame if known, otherwise fallback to main frame
      const target = editorFrameId !== undefined ? editorFrameId : 0;
      chrome.tabs.sendMessage(tabId, message, { frameId: target }).catch((err) => {
        console.warn(`[VibeScript Background] Failed to forward to frame ${target}:`, err.message);
      });
      if (editorFrameId === undefined) {
        console.warn(`[VibeScript Background] Editor frame not registered for tab ${tabId}, routing to main frame`);
      }
    }
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'llm-stream') return;

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'start') {
      const { provider, apiKey, model, messages, tools } = msg;

      try {
        const providerInstance = providerRegistry.get(provider, { apiKey, model });
        const gen = providerInstance.stream({ model, messages, tools }, { apiKey, model });

        for await (const event of gen) {
          switch (event.type) {
            case 'text_delta':
              port.postMessage({ type: 'text', text: event.delta });
              break;
            case 'reasoning_delta':
              port.postMessage({ type: 'reasoning', delta: event.delta });
              break;
            case 'usage':
              port.postMessage({ type: 'usage', usage: event.usage });
              break;
            case 'done':
              port.postMessage({ type: 'done', text: event.text, toolCalls: event.toolCalls, usage: event.usage });
              break;
            case 'error':
              port.postMessage({ type: 'error', error: event.error });
              break;
          }
        }
      } catch (err: unknown) {
        port.postMessage({ type: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    }
  });
});
