import { useUiStore } from '../sidepanel/stores/uiStore';
import { useEditorStore } from '../sidepanel/stores/editorStore';
import { useDiagnosticsStore } from '../sidepanel/stores/diagnosticsStore';
import type { ExtensionMessage } from '../shared/types';
import { mountApp, injectGlobalStyles } from './mountApp';

useDiagnosticsStore.getState().addLog(`[Content] Content script loaded. top=${window === window.top} url=${window.location.href}`);

// inject.js must be injected from background to bypass the page's CSP
useDiagnosticsStore.getState().addLog('[Content] Requesting background to run INJECT_BRIDGE');
chrome.runtime.sendMessage({ source: 'vibescript-content', action: 'INJECT_BRIDGE' });

injectGlobalStyles();
document.body.classList.add('vibescript-no-transition');

if (window === window.top) {
  mountApp();
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  useDiagnosticsStore.getState().addLog(`[Content] Received runtime message: ${message.action}`);

  if (message.action === 'SIDE_PANEL_OPENED') {
    if (window === window.top) {
      useUiStore.getState().togglePanel();
    }
    sendResponse({ success: true });
    return false;
  }

  if (window === window.top) {
    if (message.action === 'ATTACH_SELECTION') {
      useDiagnosticsStore.getState().addLog('[Content] Forwarding ATTACH_SELECTION content to editor store', 'success');
      useEditorStore.getState().addAttachment({
        filename: message.payload.filename,
        content: message.payload.content || message.payload.text || '',
        lineStart: message.payload.startLine,
        lineEnd: message.payload.endLine
      });
      useUiStore.getState().insertMention(
        message.payload.filename,
        message.payload.startLine,
        message.payload.endLine
      );
      useUiStore.getState().setPanelOpen(true);
    } else if (
      message.action === 'CODE_RESULT' ||
      message.action === 'DIFF_RESULT' ||
      message.action === 'LIST_FILES_RESULT' ||
      message.action === 'EDIT_FILE_RESULT'
    ) {
      window.postMessage({
        ...message,
        source: 'vibescript-inject',
        fromContentScript: true
      }, '*');
    }
  }
  else {
    if (
      message.action === 'GET_CODE' ||
      message.action === 'SET_CODE' ||
      message.action === 'INSERT_AT_CURSOR' ||
      message.action === 'REPLACE_SELECTION' ||
      message.action === 'LIST_FILES' ||
      message.action === 'READ_FILE_BY_NAME' ||
      message.action === 'EDIT_FILE_REVIEW' ||
      message.action === 'EDIT_FILE_REVIEW_CANCEL' ||
      message.action === 'EDIT_FILE'
    ) {
      window.postMessage(message, '*');
    }
  }

  return false;
});

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.source === 'vibescript-inject' && !data.fromContentScript) {
    const { action, payload } = data;

    if (action === 'DIAGNOSTICS_LOG') {
      useDiagnosticsStore.getState().addLog(`[Inject] ${payload.message}`, payload.type);
      return;
    }

    useDiagnosticsStore.getState().addLog(`[Content] Received from inject: ${action}`);

    if (action === 'REQUEST_COMPLETION') {
      chrome.runtime.sendMessage({
        source: 'vibescript-content',
        action: 'REQUEST_COMPLETION',
        payload
      }, (response) => {
        window.postMessage({
          source: 'vibescript-content',
          action: 'COMPLETION_RESULT',
          payload: {
            requestId: payload.requestId,
            suggestion: response?.suggestion || ''
          }
        }, '*');
      });
    } else {
      chrome.runtime.sendMessage({
        source: 'vibescript-content',
        action,
        payload
      }).catch((err) => {
        console.error(`[VibeScript Content] Failed to forward ${action} to background:`, err.message);
      });
    }
  }

  const sidepanelRequests = [
    'GET_CODE',
    'SET_CODE',
    'INSERT_AT_CURSOR',
    'REPLACE_SELECTION',
    'LIST_FILES',
    'READ_FILE_BY_NAME',
    'EDIT_FILE_REVIEW',
    'EDIT_FILE_REVIEW_CANCEL',
    'EDIT_FILE'
  ];
  if (data.source === 'vibescript-content' && window === window.top) {
    if (sidepanelRequests.includes(data.action)) {
      useDiagnosticsStore.getState().addLog(`[Content] Forwarding sidepanel message to background: ${data.action}`);
      chrome.runtime.sendMessage(data).catch((err) => {
        console.error(`[VibeScript Content] Failed to forward ${data.action} to background:`, err.message);
      });
    }
  }
});
