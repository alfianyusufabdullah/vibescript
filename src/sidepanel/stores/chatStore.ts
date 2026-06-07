import { create } from 'zustand';
import type { ChatMessage, AgentStep, CodeAttachment } from '../../shared/types';
import { generateId } from '@/lib/utils';

const CHAT_STORAGE_KEY_PREFIX = 'vibescript_chat_';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  loadHistory: (scriptId: string) => Promise<void>;
  clearHistory: (scriptId: string) => void;
  addSystemMessage: (content: string) => void;
  addUserMessage: (scriptId: string, content: string, attachments?: CodeAttachment[]) => void;
  addAgentResult: (scriptId: string, finalResponse: string, steps: AgentStep[], reasoningText?: string) => void;
  setMessages: (msgs: ChatMessage[]) => void;
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
        const storageKey = `${CHAT_STORAGE_KEY_PREFIX}${scriptId}`;
        chrome.storage.local.get([storageKey], (result) => {
          const savedMessages = (result[storageKey] || []) as ChatMessage[];
          set({ messages: savedMessages, error: null });
          resolve();
        });
      });
    } else {
      set({ messages: [] });
    }
  },

  clearHistory: (scriptId: string) => {
    if (!scriptId) {
      return;
    }
    set({ messages: [] });
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove([`${CHAT_STORAGE_KEY_PREFIX}${scriptId}`]);
    }
  },

  addSystemMessage: (content: string) => {
    const msg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: content,
      timestamp: Date.now()
    };
    set(state => ({ messages: [...state.messages, msg] }));
  },

  addUserMessage: (scriptId: string, content: string, attachments?: CodeAttachment[]) => {
    const { messages } = get();
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments
    };
    const newMessages = [...messages, userMsg];
    set({ messages: newMessages });
    persistChat(scriptId, newMessages);
  },

  addAgentResult: (scriptId: string, finalResponse: string, steps: AgentStep[], reasoningText?: string) => {
    const { messages } = get();
    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: finalResponse,
      timestamp: Date.now(),
      agentSteps: steps,
      reasoningText: reasoningText || undefined,
    };
    const finalMessages = [...messages, assistantMsg];
    set({ messages: finalMessages });
    persistChat(scriptId, finalMessages);
  },

  setMessages: (msgs: ChatMessage[]) => {
    set({ messages: msgs });
  }
}));

function persistChat(scriptId: string, messages: ChatMessage[]) {
  if (!scriptId) {
    return;
  }
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      [`${CHAT_STORAGE_KEY_PREFIX}${scriptId}`]: messages
    });
  }
}
