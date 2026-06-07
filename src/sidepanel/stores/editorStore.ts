import { create } from 'zustand';
import type { MonacoEditorContext, CodeAttachment } from '../../shared/types';
import { DEV_MOCK_FILES, getDevMockContext } from './devMocks';
import { generateId } from '@/lib/utils';

const CODE_FETCH_TIMEOUT_MS = 2000;
const LIST_FILES_TIMEOUT_MS = 5000;
const READ_FILE_TIMEOUT_MS = 2000;
const EDIT_FILE_TIMEOUT_MS = 2000;
const EDIT_REVIEW_TIMEOUT_MS = 60_000;

let editReviewTimeoutId: number | undefined;
let editReviewMessageHandler: ((event: MessageEvent) => void) | undefined;

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

function waitForInjectedMessage<T>(
  sendAction: string,
  sendPayload: Record<string, unknown>,
  responseAction: string,
  timeoutMs: number
): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const requestId = generateId();
    const payload = { ...sendPayload, requestId };

    const handler = (event: MessageEvent) => {
      if (
        event.data?.source === 'vibescript-inject' &&
        event.data?.action === responseAction &&
        event.data?.payload?.requestId === requestId
      ) {
        window.removeEventListener('message', handler);
        resolve(event.data.payload as T);
      }
    };

    window.addEventListener('message', handler);

    window.postMessage(
      { source: 'vibescript-content', action: sendAction, payload },
      '*'
    );

    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, timeoutMs);
  });
}

function isDuplicateAttachment(
  existing: CodeAttachment[],
  attachment: CodeAttachment
): boolean {
  return existing.some(
    (a) =>
      a.filename === attachment.filename &&
      a.lineStart === attachment.lineStart &&
      a.lineEnd === attachment.lineEnd &&
      a.content === attachment.content
  );
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
    if (!get().isActiveTabAppsScript) {
      return null;
    }

    const result = await waitForInjectedMessage<{ context: MonacoEditorContext | null }>(
      'GET_CODE',
      {},
      'CODE_RESULT',
      CODE_FETCH_TIMEOUT_MS
    );

    if (result?.context) {
      set({ currentContext: result.context });
      return result.context;
    }
    return null;
  },

  setCode: async (code: string) => {
    window.postMessage(
      { source: 'vibescript-content', action: 'SET_CODE', payload: { code } },
      '*'
    );
  },

  insertAtCursor: async (code: string) => {
    window.postMessage(
      { source: 'vibescript-content', action: 'INSERT_AT_CURSOR', payload: { code } },
      '*'
    );
  },

  replaceSelection: async (code: string) => {
    window.postMessage(
      { source: 'vibescript-content', action: 'REPLACE_SELECTION', payload: { code } },
      '*'
    );
  },

  listOpenFiles: async () => {
    if (!get().isActiveTabAppsScript) {
      return DEV_MOCK_FILES;
    }

    const result = await waitForInjectedMessage<{ files: FileInfo[] }>(
      'LIST_FILES',
      {},
      'LIST_FILES_RESULT',
      LIST_FILES_TIMEOUT_MS
    );

    return result?.files ?? [];
  },

  readFileByName: async (filename: string) => {
    if (!get().isActiveTabAppsScript) {
      return getDevMockContext(filename);
    }

    const result = await waitForInjectedMessage<{ context: MonacoEditorContext | null }>(
      'READ_FILE_BY_NAME',
      { filename },
      'CODE_RESULT',
      READ_FILE_TIMEOUT_MS
    );

    return result?.context ?? null;
  },

  editFile: async (search: string, replace: string): Promise<EditFileResult> => {
    const result = await waitForInjectedMessage<EditFileResult>(
      'EDIT_FILE',
      { search, replace },
      'EDIT_FILE_RESULT',
      EDIT_FILE_TIMEOUT_MS
    );

    return result ?? { success: false, matchCount: 0, error: 'Timeout' };
  },

  editFileWithReview: async (search: string, replace: string): Promise<EditFileReviewResult> => {
    const requestId = generateId();

    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (
          event.data?.source === 'vibescript-inject' &&
          event.data?.action === 'DIFF_RESULT' &&
          event.data?.payload?.requestId === requestId
        ) {
          if (editReviewTimeoutId) {
            clearTimeout(editReviewTimeoutId);
            editReviewTimeoutId = undefined;
          }
          window.removeEventListener('message', handler);
          if (editReviewMessageHandler === handler) {
            editReviewMessageHandler = undefined;
          }
          resolve(event.data.payload);
        }
      };

      editReviewMessageHandler = handler;
      window.addEventListener('message', handler);
      window.postMessage(
        {
          source: 'vibescript-content',
          action: 'EDIT_FILE_REVIEW',
          payload: { requestId, search, replace }
        },
        '*'
      );

      editReviewTimeoutId = window.setTimeout(() => {
        window.removeEventListener('message', handler);
        if (editReviewMessageHandler === handler) {
          editReviewMessageHandler = undefined;
        }
        editReviewTimeoutId = undefined;
        resolve({ approved: false, output: 'Timeout' });
      }, EDIT_REVIEW_TIMEOUT_MS);
    });
  },

  cancelDiffReview: () => {
    if (editReviewTimeoutId) {
      clearTimeout(editReviewTimeoutId);
      editReviewTimeoutId = undefined;
    }
    if (editReviewMessageHandler) {
      window.removeEventListener('message', editReviewMessageHandler);
      editReviewMessageHandler = undefined;
    }
    window.postMessage(
      { source: 'vibescript-content', action: 'EDIT_FILE_REVIEW_CANCEL', payload: {} },
      '*'
    );
  },

  addAttachment: (attachment: CodeAttachment) => {
    const existing = get().draftAttachments;
    if (!isDuplicateAttachment(existing, attachment)) {
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
