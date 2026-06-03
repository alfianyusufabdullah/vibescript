import { create } from 'zustand';

interface UiState {
  initialized: boolean;
  isPanelOpen: boolean;
  activeTab: 'chat' | 'settings';
  draftInput: string;
  panelWidth: number;

  setPanelOpen: (isOpen: boolean) => void;
  togglePanel: () => void;
  setActiveTab: (tab: 'chat' | 'settings') => void;
  setDraftInput: (input: string) => void;
  setPanelWidth: (width: number) => void;
  loadUiState: () => Promise<void>;
}

interface SavedUiState {
  isPanelOpen?: boolean;
  activeTab?: 'chat' | 'settings';
  draftInput?: string;
  panelWidth?: number;
}

export const useUiStore = create<UiState>((set, get) => ({
  initialized: false,
  isPanelOpen: false,
  activeTab: 'chat',
  draftInput: '',
  panelWidth: 380,

  setPanelOpen: (isOpen) => {
    set({ isPanelOpen: isOpen });
    saveUiState(get());
  },

  togglePanel: () => {
    set((state) => ({ isPanelOpen: !state.isPanelOpen }));
    saveUiState(get());
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
    saveUiState(get());
  },

  setDraftInput: (input) => {
    set({ draftInput: input });
    saveUiState(get());
  },

  setPanelWidth: (width) => {
    set({ panelWidth: width });
    saveUiState(get());
  },

  loadUiState: async () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise<void>((resolve) => {
        chrome.storage.local.get(['vibescript_ui_state'], (result) => {
          if (result.vibescript_ui_state) {
            const saved = result.vibescript_ui_state as SavedUiState;
            set({
              isPanelOpen: saved.isPanelOpen ?? false,
              activeTab: saved.activeTab ?? 'chat',
              draftInput: saved.draftInput ?? '',
              panelWidth: saved.panelWidth ?? 380,
              initialized: true
            });
          } else {
            set({ initialized: true });
          }
          resolve();
        });
      });
    } else {
      set({ initialized: true });
    }
  }
}));

function saveUiState(state: UiState) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      vibescript_ui_state: {
        isPanelOpen: state.isPanelOpen,
        activeTab: state.activeTab,
        draftInput: state.draftInput,
        panelWidth: state.panelWidth
      }
    });
  }
}

