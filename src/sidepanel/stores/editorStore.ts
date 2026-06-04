import { create } from 'zustand';
import type { MonacoEditorContext, CodeAttachment } from '../../shared/types';

export interface FileInfo {
  name: string;
  language: string;
  isActive: boolean;
}

interface EditFileResult {
  success: boolean;
  matchCount: number;
  error?: string;
}

interface EditFileReviewResult {
  approved: boolean;
  output: string;
}

interface EditorState {
  currentContext: MonacoEditorContext | null;
  scriptId: string | null;
  isActiveTabAppsScript: boolean;
  draftAttachments: CodeAttachment[];
  
  detectActiveTab: () => Promise<void>;
  fetchContext: () => Promise<MonacoEditorContext | null>;
  setCode: (code: string) => Promise<void>;
  insertAtCursor: (code: string) => Promise<void>;
  replaceSelection: (code: string) => Promise<void>;
  listOpenFiles: () => Promise<FileInfo[]>;
  readFileByName: (filename: string) => Promise<MonacoEditorContext | null>;
  editFile: (search: string, replace: string) => Promise<EditFileResult>;
  editFileWithReview: (search: string, replace: string) => Promise<EditFileReviewResult>;

  cancelDiffReview: () => void;
  addAttachment: (attachment: CodeAttachment) => void;
  removeAttachment: (index: number) => void;
  clearAttachments: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentContext: null,
  scriptId: null,
  isActiveTabAppsScript: false,
  draftAttachments: [],

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
    if (!get().isActiveTabAppsScript) {
      return [
        { name: 'Code.gs', language: 'javascript', isActive: true },
        { name: 'Ui.html', language: 'html', isActive: false },
        { name: 'Helpers.gs', language: 'javascript', isActive: false },
      ];
    }

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
    if (!get().isActiveTabAppsScript) {
      if (filename === 'Code.gs') {
        return {
          code: `function doGet() {\n  return HtmlService.createHtmlOutputFromFile('Ui');\n}\n\nfunction getSpreadsheetData() {\n  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();\n  return sheet.getDataRange().getValues();\n}`,
          filename: 'Code.gs',
          language: 'javascript',
          position: null,
          selection: null,
          selectedText: ''
        };
      }
      if (filename === 'Ui.html') {
        return {
          code: `<!DOCTYPE html>\n<html>\n  <head>\n    <base target="_top">\n  </head>\n  <body>\n    <h1>Hello VibeScript</h1>\n    <script>\n      console.log('App loaded');\n    </script>\n  </body>\n</html>`,
          filename: 'Ui.html',
          language: 'html',
          position: null,
          selection: null,
          selectedText: ''
        };
      }
      if (filename === 'Helpers.gs') {
        return {
          code: `function formatName(name) {\n  return name ? name.toUpperCase() : 'ANONYMOUS';\n}\n\nfunction logAction(action) {\n  Logger.log('Action performed: ' + action);\n}`,
          filename: 'Helpers.gs',
          language: 'javascript',
          position: null,
          selection: null,
          selectedText: ''
        };
      }
      return null;
    }

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
  },

  editFileWithReview: async (search: string, replace: string): Promise<EditFileReviewResult> => {
    const requestId = Math.random().toString(36).substring(7);

    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (
          event.data?.source === 'vibescript-inject' &&
          event.data?.action === 'DIFF_RESULT' &&
          event.data?.payload?.requestId === requestId
        ) {
          window.removeEventListener('message', handler);
          resolve(event.data.payload);
        }
      };

      window.addEventListener('message', handler);
      window.postMessage({
        source: 'vibescript-content',
        action: 'EDIT_FILE_REVIEW',
        payload: { requestId, search, replace }
      }, '*');

      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ approved: false, output: 'Timeout' });
      }, 300000);
    });
  },

  cancelDiffReview: () => {
    window.postMessage({
      source: 'vibescript-content',
      action: 'EDIT_FILE_REVIEW_CANCEL',
      payload: {}
    }, '*');
  },

  addAttachment: (attachment: CodeAttachment) => {
    const existing = get().draftAttachments;
    const isDuplicate = existing.some(
      (a) =>
        a.filename === attachment.filename &&
        a.lineStart === attachment.lineStart &&
        a.lineEnd === attachment.lineEnd &&
        a.content === attachment.content
    );
    if (!isDuplicate) {
      set({ draftAttachments: [...existing, attachment] });
    }
  },

  removeAttachment: (index: number) => {
    const existing = get().draftAttachments;
    set({ draftAttachments: existing.filter((_, i) => i !== index) });
  },

  clearAttachments: () => {
    set({ draftAttachments: [] });
  }
}));
