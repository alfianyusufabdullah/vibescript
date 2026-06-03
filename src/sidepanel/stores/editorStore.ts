import { create } from 'zustand';
import type { MonacoEditorContext } from '../../shared/types';

interface EditorState {
  currentContext: MonacoEditorContext | null;
  scriptId: string | null;
  isActiveTabAppsScript: boolean;
  
  detectActiveTab: () => Promise<void>;
  fetchContext: () => Promise<MonacoEditorContext | null>;
  setCode: (code: string) => Promise<void>;
  insertAtCursor: (code: string) => Promise<void>;
  replaceSelection: (code: string) => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentContext: null,
  scriptId: null,
  isActiveTabAppsScript: false,

  detectActiveTab: async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      set({ isActiveTabAppsScript: false, scriptId: 'dev-mode' });
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      set({ isActiveTabAppsScript: false, scriptId: null });
      return;
    }

    const url = tab.url;
    const match = url.match(/\/(?:d|projects)\/([a-zA-Z0-9-_]+)/);
    
    if (url.includes('script.google.com') && match) {
      set({ isActiveTabAppsScript: true, scriptId: match[1] });
    } else {
      set({ isActiveTabAppsScript: false, scriptId: null });
    }
  },

  fetchContext: async () => {
    await get().detectActiveTab();
    if (!get().isActiveTabAppsScript) return null;

    if (typeof chrome === 'undefined' || !chrome.tabs) return null;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return null;

    return new Promise<MonacoEditorContext | null>((resolve) => {
      chrome.tabs.sendMessage(
        tab.id!,
        {
          source: 'vibescript-sidepanel',
          action: 'GET_CODE'
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Error fetching editor context:', chrome.runtime.lastError.message);
            resolve(null);
            return;
          }
          
          if (response && response.success && response.context) {
            set({ currentContext: response.context });
            resolve(response.context);
          } else {
            resolve(null);
          }
        }
      );
    });
  },

  setCode: async (code: string) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    chrome.tabs.sendMessage(tab.id, {
      source: 'vibescript-sidepanel',
      action: 'SET_CODE',
      payload: { code }
    });
  },

  insertAtCursor: async (code: string) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    chrome.tabs.sendMessage(tab.id, {
      source: 'vibescript-sidepanel',
      action: 'INSERT_AT_CURSOR',
      payload: { code }
    });
  },

  replaceSelection: async (code: string) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    chrome.tabs.sendMessage(tab.id, {
      source: 'vibescript-sidepanel',
      action: 'REPLACE_SELECTION',
      payload: { code }
    });
  }
}));
