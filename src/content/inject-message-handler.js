import { getActiveEditor, getMonaco, getEditorContext } from './inject-editor-utils.js';
import { showDiffOverlay } from './inject-diff-overlay.js';
import { state } from './inject-state.js';
import { logDiagnostics } from './inject-log.js';

const FILE_POLL_TIMEOUT_MS = 3000;
const FILE_POLL_INTERVAL_MS = 200;

function isValidFileName(name) {
  return name &&
    !name.includes('output') &&
    !name.includes('terminal') &&
    !name.startsWith('inmemory') &&
    isNaN(Number(name));
}

export function setupMessageHandler() {
  window.addEventListener('message', (event) => {
    if (event.data?.source !== 'vibescript-content') return;

    const editor = getActiveEditor();
    const monaco = getMonaco();

    switch (event.data.action) {
      case 'GET_CODE': {
        const requestId = event.data.payload?.requestId;
        const ctx = getEditorContext();
        window.postMessage({
          source: 'vibescript-inject',
          action: 'CODE_RESULT',
          payload: { requestId, context: ctx }
        }, '*');
        break;
      }

      case 'SET_CODE': {
        if (!editor) return;
        const model = editor.getModel();
        if (!model) return;
        try {
          editor.executeEdits('vibescript', [{
            range: model.getFullModelRange(),
            text: event.data.payload.code,
            forceMoveMarkers: true,
          }]);
        } catch (e) {
          console.error('[VibeScript] SET_CODE executeEdits error:', e);
        }
        break;
      }

      case 'INSERT_AT_CURSOR': {
        if (!editor) return;
        const position = editor.getPosition();
        if (!position) return;
        try {
          editor.executeEdits('vibescript', [{
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            text: event.data.payload.code,
            forceMoveMarkers: true,
          }]);
        } catch (e) {
          console.error('[VibeScript] INSERT_AT_CURSOR executeEdits error:', e);
        }
        break;
      }

      case 'REPLACE_SELECTION': {
        if (!editor) return;
        const selection = editor.getSelection();
        if (!selection) return;
        try {
          editor.executeEdits('vibescript', [{
            range: selection,
            text: event.data.payload.code,
            forceMoveMarkers: true,
          }]);
        } catch (e) {
          console.error('[VibeScript] REPLACE_SELECTION executeEdits error:', e);
        }
        break;
      }

      case 'LIST_FILES': {
        const listFilesRequestId = event.data.payload?.requestId;
        let files = [];
        state.fileModelMap.clear();

        try {
          const fileList = document.querySelector('ul[role="listbox"][aria-label="Project files"]');
          if (fileList) {
            const items = fileList.querySelectorAll('li[role="option"]');
            const models = monaco && monaco.editor ? monaco.editor.getModels() : [];
            let modelIdx = 0;
            items.forEach((item) => {
              const name = item.getAttribute('aria-label');
              if (name && !name.startsWith('File operations')) {
                const isSelected = item.getAttribute('aria-selected') === 'true' || item.classList.contains('UeVsd');
                files.push({
                  name,
                  language: name.endsWith('.html') || name.endsWith('.htm') ? 'html' : 'javascript',
                  isActive: isSelected,
                });
                if (modelIdx < models.length) {
                  state.fileModelMap.set(name, models[modelIdx]);
                }
                modelIdx++;
              }
            });
          }
        } catch (e) {
          logDiagnostics(`DOM file list extraction failed: ${e.message}`, 'warn');
        }

        if (files.length === 0 && monaco && monaco.editor) {
          const activeEditor = getActiveEditor();
          const activeModel = activeEditor ? activeEditor.getModel() : null;
          const models = monaco.editor.getModels();
          files = models
            .map((m) => {
              const path = m.uri.path;
              const name = path.replace(/^\//, '');
              return {
                name: name || 'untitled',
                language: m.getLanguageId(),
                isActive: activeModel ? activeModel.uri.toString() === m.uri.toString() : false,
              };
            })
            .filter((f) => isValidFileName(f.name));
        }

        const listFilesStart = Date.now();
        function pollForFiles() {
          const polledFiles = files.length > 0 ? files : (() => {
            // Re-query only if we have no results yet
            return files;
          })();
          if (polledFiles.length > 0 || (Date.now() - listFilesStart) >= FILE_POLL_TIMEOUT_MS) {
            window.postMessage({
              source: 'vibescript-inject',
              action: 'LIST_FILES_RESULT',
              payload: { requestId: listFilesRequestId, files: polledFiles }
            }, '*');
          } else {
            setTimeout(pollForFiles, FILE_POLL_INTERVAL_MS);
          }
        }
        pollForFiles();
        break;
      }

      case 'READ_FILE_BY_NAME': {
        const filename = event.data.payload?.filename;
        const reqId = event.data.payload?.requestId;
        const model = state.fileModelMap.get(filename);

        if (model) {
          window.postMessage({
            source: 'vibescript-inject',
            action: 'CODE_RESULT',
            payload: {
              requestId: reqId,
              context: {
                code: model.getValue(),
                language: model.getLanguageId(),
                position: null,
                selection: null,
                selectedText: '',
              }
            }
          }, '*');
        } else {
          try {
            const escapedName = filename.replace(/"/g, '\\"');
            const fileItem = document.querySelector(`li[role="option"][aria-label="${escapedName}"]`);
            if (fileItem) {
              fileItem.click();
              setTimeout(() => {
                const ed = getActiveEditor();
                if (ed) {
                  const m = ed.getModel();
                  if (m) {
                    window.postMessage({
                      source: 'vibescript-inject',
                      action: 'CODE_RESULT',
                      payload: {
                        requestId: reqId,
                        context: {
                          code: m.getValue(),
                          language: m.getLanguageId(),
                          position: null,
                          selection: null,
                          selectedText: '',
                        }
                      }
                    }, '*');
                    return;
                  }
                }
                window.postMessage({
                  source: 'vibescript-inject',
                  action: 'CODE_RESULT',
                  payload: { requestId: reqId, context: null }
                }, '*');
              }, FILE_POLL_INTERVAL_MS);
            } else {
              window.postMessage({
                source: 'vibescript-inject',
                action: 'CODE_RESULT',
                payload: { requestId: reqId, context: null }
              }, '*');
            }
          } catch (e) {
            logDiagnostics(`DOM click for "${filename}" failed: ${e.message}`, 'warn');
            window.postMessage({
              source: 'vibescript-inject',
              action: 'CODE_RESULT',
              payload: { requestId: reqId, context: null }
            }, '*');
          }
        }
        break;
      }

      case 'EDIT_FILE_REVIEW': {
        if (!editor) return; // No Monaco in this frame — Monaco iframe will handle it
        const model = editor.getModel();
        if (!model) return; // Same reason — let Monaco iframe respond

        const { search, replace, requestId } = event.data.payload;
        const matches = model.findMatches(search, undefined, false, true, null, false, 5);
        let range, original, modified;

        if (matches.length === 1) {
          range = matches[0].range;
          original = model.getValue();
          const startOff = model.getOffsetAt(range.getStartPosition());
          const endOff = model.getOffsetAt(range.getEndPosition());
          modified = original.slice(0, startOff) + replace + original.slice(endOff);
        } else if (matches.length > 1) {
          const positions = matches.map((m) => `line ${m.range.startLineNumber}`);
          window.postMessage({
            source: 'vibescript-inject',
            action: 'DIFF_RESULT',
            payload: {
              requestId,
              approved: false,
              output: `Ambiguous: ${matches.length} matches at ${positions.join(', ')}`,
            }
          }, '*');
          return;
        } else {
          const fullText = model.getValue();
          if (fullText.includes(search)) {
            modified = fullText.replace(search, replace);
            if (modified !== fullText) {
              range = model.getFullModelRange();
              original = fullText;
            } else {
              window.postMessage({
                source: 'vibescript-inject',
                action: 'DIFF_RESULT',
                payload: { requestId, approved: false, output: 'No match found' }
              }, '*');
              return;
            }
          } else {
            window.postMessage({
              source: 'vibescript-inject',
              action: 'DIFF_RESULT',
              payload: { requestId, approved: false, output: 'No match found' }
            }, '*');
            return;
          }
        }

        showDiffOverlay(editor, original, modified, range, replace, requestId);
        break;
      }

      case 'EDIT_FILE_REVIEW_CANCEL': {
        if (state.diffOverlayCleanup) state.diffOverlayCleanup();
        break;
      }

      case 'EDIT_FILE': {
        if (!editor) return;
        const model = editor.getModel();
        if (!model) return;
        const { search, replace, requestId } = event.data.payload;
        const matches = model.findMatches(search, undefined, false, true, null, false, 5);

        if (matches.length === 0) {
          const fullText = model.getValue();
          if (fullText.includes(search)) {
            const newText = fullText.replace(search, replace);
            if (newText !== fullText) {
              try {
                editor.executeEdits('vibescript', [{
                  range: model.getFullModelRange(),
                  text: newText,
                  forceMoveMarkers: true,
                }]);
              } catch (e) {
                console.error('[VibeScript] EDIT_FILE fallback executeEdits error:', e);
              }
              window.postMessage({
                source: 'vibescript-inject',
                action: 'EDIT_FILE_RESULT',
                payload: { requestId, success: true, matchCount: 1 }
              }, '*');
              break;
            }
          }
          window.postMessage({
            source: 'vibescript-inject',
            action: 'EDIT_FILE_RESULT',
            payload: { requestId, success: false, error: 'No match found for the search text', matchCount: 0 }
          }, '*');
        } else if (matches.length > 1) {
          const positions = matches.map((m) => `line ${m.range.startLineNumber}`);
          window.postMessage({
            source: 'vibescript-inject',
            action: 'EDIT_FILE_RESULT',
            payload: {
              requestId,
              success: false,
              matchCount: matches.length,
              error: `Found ${matches.length} matches at ${positions.join(', ')}. Provide more surrounding context to make the search unique.`,
            }
          }, '*');
        } else {
          try {
            editor.executeEdits('vibescript', [{
              range: matches[0].range,
              text: replace,
              forceMoveMarkers: true,
            }]);
          } catch (e) {
            console.error('[VibeScript] EDIT_FILE single executeEdits error:', e);
          }
          window.postMessage({
            source: 'vibescript-inject', action: 'EDIT_FILE_RESULT',
            payload: { requestId, success: true, matchCount: 1 }
          }, '*');
        }
        break;
      }
    }
  });
}
