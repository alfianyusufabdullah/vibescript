import { create } from 'zustand';

const DEFAULT_PANEL_WIDTH_PX = 380;

interface UiState {
  initialized: boolean;
  isPanelOpen: boolean;
  activeTab: 'chat' | 'settings';
  draftInput: string;
  panelWidth: number;
  selectedRole: string;

  setPanelOpen: (isOpen: boolean) => void;
  togglePanel: () => void;
  setActiveTab: (tab: 'chat' | 'settings') => void;
  setDraftInput: (input: string) => void;
  setPanelWidth: (width: number) => void;
  setSelectedRole: (role: string) => void;
  loadUiState: () => Promise<void>;
  insertMention: (filename: string, lineStart?: number, lineEnd?: number) => void;
}

interface SavedUiState {
  isPanelOpen?: boolean;
  activeTab?: 'chat' | 'settings';
  draftInput?: string;
  panelWidth?: number;
  selectedRole?: string;
}

export const useUiStore = create<UiState>((set, get) => ({
  initialized: false,
  isPanelOpen: false,
  activeTab: 'chat',
  draftInput: '',
  panelWidth: DEFAULT_PANEL_WIDTH_PX,
  selectedRole: 'build',

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

  setSelectedRole: (role) => {
    set({ selectedRole: role });
    saveUiState(get());
  },

  insertMention: (filename, lineStart, lineEnd) => {
    const { draftInput } = get();
    const mention = lineStart !== undefined && lineEnd !== undefined
      ? `@${filename}:${lineStart}-${lineEnd}`
      : lineStart !== undefined
      ? `@${filename}:${lineStart}`
      : `@${filename}`;
    const space = draftInput && !draftInput.endsWith(' ') ? ' ' : '';
    const newText = `${draftInput}${space}${mention} `;
    set({ draftInput: newText });
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
              panelWidth: saved.panelWidth ?? DEFAULT_PANEL_WIDTH_PX,
              selectedRole: saved.selectedRole ?? 'build',
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
        panelWidth: state.panelWidth,
        selectedRole: state.selectedRole,
      }
    });
  }
}
