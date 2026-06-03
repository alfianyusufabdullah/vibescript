import { create } from 'zustand';
import type { ChatMessage, Provider } from '../../shared/types';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  loadHistory: (scriptId: string) => Promise<void>;
  sendMessage: (
    prompt: string,
    contextInfo: {
      provider: Provider;
      apiKey: string;
      model: string;
      editorContext: any;
    }
  ) => Promise<void>;
  clearHistory: (scriptId: string) => void;
  addSystemMessage: (content: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,

  loadHistory: async (scriptId: string) => {
    if (!scriptId) {
      set({ messages: [] });
      return;
    }
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise<void>((resolve) => {
        chrome.storage.local.get([`vibescript_chat_${scriptId}`], (result) => {
          const savedMessages = (result[`vibescript_chat_${scriptId}`] || []) as ChatMessage[];
          set({ messages: savedMessages, error: null });
          resolve();
        });
      });
    } else {
      set({ messages: [] });
    }
  },

  sendMessage: async (prompt, { provider, apiKey, model, editorContext }) => {
    const { messages } = get();
    const scriptId = editorContext?.scriptId || 'global';

    // 1. Create and add user message
    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: prompt,
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, userMessage];
    set({ messages: updatedMessages, isLoading: true, error: null });
    persistChat(scriptId, updatedMessages);

    // 2. Build full context prompt including editor state
    let promptWithContext = prompt;
    if (editorContext) {
      promptWithContext = `
Active File Code Context:
\`\`\`javascript
${editorContext.code}
\`\`\`

Cursor Position: Line ${editorContext.position?.line || 'unknown'}, Column ${editorContext.position?.col || 'unknown'}
Selected Text: ${editorContext.selectedText ? `\n\`\`\`javascript\n${editorContext.selectedText}\n\`\`\`` : 'none'}

User Prompt:
${prompt}
      `.trim();
    }

    // 3. Prepare messages for LLM
    // We send a sliding window or the whole history. Let's send the whole history but swap the content of the last user message with promptWithContext so that LLM knows the context.
    const llmMessages = updatedMessages.map((msg, index) => {
      if (index === updatedMessages.length - 1) {
        return { ...msg, content: promptWithContext };
      }
      return msg;
    });

    // 4. Send request to background proxy to bypass potential CORS/extension constraints
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(
        {
          source: 'vibescript-sidepanel',
          action: 'LLM_REQUEST',
          payload: {
            provider,
            apiKey,
            model,
            messages: llmMessages
          }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            set({
              isLoading: false,
              error: `Extension communication error: ${chrome.runtime.lastError.message}`
            });
            return;
          }

          if (response && response.success && response.text) {
            const assistantMessage: ChatMessage = {
              id: Math.random().toString(36).substring(7),
              role: 'assistant',
              content: response.text,
              timestamp: Date.now()
            };

            const finalMessages = [...updatedMessages, assistantMessage];
            set({ messages: finalMessages, isLoading: false });
            persistChat(scriptId, finalMessages);
          } else {
            set({
              isLoading: false,
              error: response?.error || 'Failed to get response from AI.'
            });
          }
        }
      );
    } else {
      // Dev mode fallback
      setTimeout(() => {
        const mockResponse: ChatMessage = {
          id: Math.random().toString(36).substring(7),
          role: 'assistant',
          content: 'This is a mock response because you are in development mode outside of the Chrome Extension container.',
          timestamp: Date.now()
        };
        const finalMessages = [...updatedMessages, mockResponse];
        set({ messages: finalMessages, isLoading: false });
      }, 1000);
    }
  },

  clearHistory: (scriptId: string) => {
    if (!scriptId) return;
    set({ messages: [] });
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove([`vibescript_chat_${scriptId}`]);
    }
  },

  addSystemMessage: (content: string) => {
    const msg: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: 'assistant',
      content: content,
      timestamp: Date.now()
    };
    set(state => ({ messages: [...state.messages, msg] }));
  }
}));

function persistChat(scriptId: string, messages: ChatMessage[]) {
  if (!scriptId) return;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      [`vibescript_chat_${scriptId}`]: messages
    });
  }
}
