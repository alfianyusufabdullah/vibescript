import { create } from 'zustand';
import type { MonacoEditorContext } from '../../shared/types';

interface FileInfo {
  name: string;
  language: string;
  isActive: boolean;
}

interface EditFileResult {
  success: boolean;
  matchCount: number;
  error?: string;
}

interface EditorState {
  currentContext: MonacoEditorContext | null;
  scriptId: string | null;
  isActiveTabAppsScript: boolean;
  
  detectActiveTab: () => Promise<void>;
  fetchContext: () => Promise<MonacoEditorContext | null>;
  setCode: (code: string) => Promise<void>;
  insertAtCursor: (code: string) => Promise<void>;
  replaceSelection: (code: string) => Promise<void>;
  listOpenFiles: () => Promise<FileInfo[]>;
  readFileByName: (filename: string) => Promise<MonacoEditorContext | null>;
  editFile: (search: string, replace: string) => Promise<EditFileResult>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentContext: null,
  scriptId: null,
  isActiveTabAppsScript: false,

  detectActiveTab: async () => {
    if (typeof window === 'undefined') {
      set({ isActiveTabAppsScript: false, scriptId: null });
      return;
    }

    const url = window.location.href;
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

    const requestId = Math.random().toString(36).substring(7);

    return new Promise<MonacoEditorContext | null>((resolve) => {
      const handler = (event: MessageEvent) => {
        if (
          event.data?.source === 'vibescript-inject' &&
          event.data?.action === 'CODE_RESULT' &&
          event.data?.payload?.requestId === requestId
        ) {
          window.removeEventListener('message', handler);
          const context = event.data.payload.context;
          if (context) {
            set({ currentContext: context });
            resolve(context);
          } else {
            resolve(null);
          }
        }
      };

      window.addEventListener('message', handler);

      // Send to injected page-context script
      window.postMessage({
        source: 'vibescript-content',
        action: 'GET_CODE',
        payload: { requestId }
      }, '*');

      // 2 second timeout to prevent hanging
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 2000);
    });
  },

  setCode: async (code: string) => {
    window.postMessage({
      source: 'vibescript-content',
      action: 'SET_CODE',
      payload: { code }
    }, '*');
  },

  insertAtCursor: async (code: string) => {
    window.postMessage({
      source: 'vibescript-content',
      action: 'INSERT_AT_CURSOR',
      payload: { code }
    }, '*');
  },

  replaceSelection: async (code: string) => {
    window.postMessage({
      source: 'vibescript-content',
      action: 'REPLACE_SELECTION',
      payload: { code }
    }, '*');
  },

  listOpenFiles: async () => {
    const requestId = Math.random().toString(36).substring(7);

    return new Promise<FileInfo[]>((resolve) => {
      const handler = (event: MessageEvent) => {
        if (
          event.data?.source === 'vibescript-inject' &&
          event.data?.action === 'LIST_FILES_RESULT' &&
          event.data?.payload?.requestId === requestId
        ) {
          window.removeEventListener('message', handler);
          resolve(event.data.payload.files || []);
        }
      };

      window.addEventListener('message', handler);
      window.postMessage({
        source: 'vibescript-content',
        action: 'LIST_FILES',
        payload: { requestId }
      }, '*');

      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve([]);
      }, 2000);
    });
  },

  readFileByName: async (filename: string) => {
    const requestId = Math.random().toString(36).substring(7);

    return new Promise<MonacoEditorContext | null>((resolve) => {
      const handler = (event: MessageEvent) => {
        if (
          event.data?.source === 'vibescript-inject' &&
          event.data?.action === 'CODE_RESULT' &&
          event.data?.payload?.requestId === requestId
        ) {
          window.removeEventListener('message', handler);
          const context = event.data.payload.context;
          if (context) {
            resolve(context);
          } else {
            resolve(null);
          }
        }
      };

      window.addEventListener('message', handler);
      window.postMessage({
        source: 'vibescript-content',
        action: 'READ_FILE_BY_NAME',
        payload: { requestId, filename }
      }, '*');

      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 2000);
    });
  },

  editFile: async (search: string, replace: string): Promise<EditFileResult> => {
    const requestId = Math.random().toString(36).substring(7);

    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (
          event.data?.source === 'vibescript-inject' &&
          event.data?.action === 'EDIT_FILE_RESULT' &&
          event.data?.payload?.requestId === requestId
        ) {
          window.removeEventListener('message', handler);
          resolve(event.data.payload);
        }
      };

      window.addEventListener('message', handler);
      window.postMessage({
        source: 'vibescript-content',
        action: 'EDIT_FILE',
        payload: { requestId, search, replace }
      }, '*');

      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ success: false, matchCount: 0, error: 'Timeout' });
      }, 2000);
    });
  }
}));
