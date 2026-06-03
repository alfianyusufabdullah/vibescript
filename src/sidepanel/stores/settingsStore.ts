import { create } from 'zustand';
import type { Provider, Settings } from '../../shared/types';
import { PROVIDERS } from '../../shared/constants';

interface SettingsState extends Settings {
  initialized: boolean;
  setProvider: (provider: Provider) => void;
  setApiKey: (provider: Provider, key: string) => void;
  setModel: (provider: Provider, model: string) => void;
  loadSettings: () => Promise<void>;
}

const DEFAULT_SETTINGS: Settings = {
  provider: 'gemini',
  apiKeys: {
    gemini: '',
    openai: '',
    anthropic: '',
    deepseek: ''
  },
  models: {
    gemini: PROVIDERS.gemini.defaultModel,
    openai: PROVIDERS.openai.defaultModel,
    anthropic: PROVIDERS.anthropic.defaultModel,
    deepseek: PROVIDERS.deepseek.defaultModel
  }
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  initialized: false,

  setProvider: (provider: Provider) => {
    set({ provider });
    saveSettings(get());
  },

  setApiKey: (provider: Provider, key: string) => {
    set((state) => ({
      apiKeys: { ...state.apiKeys, [provider]: key }
    }));
    saveSettings(get());
  },

  setModel: (provider: Provider, model: string) => {
    set((state) => ({
      models: { ...state.models, [provider]: model }
    }));
    saveSettings(get());
  },

  loadSettings: async () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise<void>((resolve) => {
        chrome.storage.local.get(['vibescript_settings'], (result) => {
          if (result.vibescript_settings) {
            const saved = result.vibescript_settings as Settings;
            set({
              provider: saved.provider || DEFAULT_SETTINGS.provider,
              apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...(saved.apiKeys || {}) },
              models: { ...DEFAULT_SETTINGS.models, ...(saved.models || {}) },
              initialized: true
            });
          } else {
            set({ initialized: true });
          }
          resolve();
        });
      });
    } else {
      // Fallback for development outside extension
      set({ initialized: true });
    }
  }
}));

function saveSettings(state: SettingsState) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      vibescript_settings: {
        provider: state.provider,
        apiKeys: state.apiKeys,
        models: state.models
      }
    });
  }
}
