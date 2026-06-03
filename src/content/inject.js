(function () {
  const getMonaco = () => window.monaco;

  function getActiveEditor() {
    const monaco = getMonaco();
    if (!monaco || !monaco.editor) return null;
    const editors = monaco.editor.getEditors();
    // Return the editor that is currently focused or the first one
    return editors.find((e) => e.hasWidgetFocus()) || editors[0] || null;
  }

  function getEditorContext() {
    const editor = getActiveEditor();
    return editor ? contextFromEditor(editor) : null;
  }

  function contextFromEditor(editor) {
    const model = editor.getModel();
    if (!model) return null;

    const code = editor.getValue();
    const language = model.getLanguageId();
    const position = editor.getPosition();
    const selection = editor.getSelection();
    const selectedText = selection ? model.getValueInRange(selection) : '';

    return {
      code,
      language,
      position: position ? { line: position.lineNumber, col: position.column } : null,
      selection: selection ? {
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLineNumber: selection.endLineNumber,
        endColumn: selection.endColumn
      } : null,
      selectedText
    };
  }

  // State for diff overlay
  let _diffOverlayCleanup = null;


  function _langFromFilename(fn) {
    const ext = fn.split('.').pop();
    const map = { gs: 'javascript', js: 'javascript', ts: 'typescript', html: 'html', css: 'css', json: 'json', md: 'markdown' };
    return map[ext] || 'javascript';
  }

  function _showDiffOverlay(editor, original, modified, range, replaceText, requestId, optFilename, onApprove) {
    const monaco = getMonaco();
    const model = editor.getModel();
    if (!model) return;

    const fileName = optFilename || (model.uri ? model.uri.path.replace(/^\//, '') : 'untitled');
    const lang = optFilename ? _langFromFilename(optFilename) : model.getLanguageId();
    const container = editor.getContainerDomNode();
    container.style.position = 'relative';

    const overlay = document.createElement('div');
    overlay.id = 'vibescript-diff-overlay';

    const header = document.createElement('div');
    header.id = 'vibescript-diff-header';
    const filenameEl = document.createElement('span');
    filenameEl.id = 'vibescript-diff-filename';
    filenameEl.textContent = fileName;
    header.appendChild(filenameEl);
    const statsEl = document.createElement('span');
    statsEl.id = 'vibescript-diff-stats';
    header.appendChild(statsEl);
    overlay.appendChild(header);

    const diffContainer = document.createElement('div');
    diffContainer.id = 'vibescript-diff-container';
    overlay.appendChild(diffContainer);

    const footer = document.createElement('div');
    footer.id = 'vibescript-diff-footer';
    const rejectBtn = document.createElement('button');
    rejectBtn.id = 'vibescript-diff-reject';
    rejectBtn.textContent = 'Reject';
    footer.appendChild(rejectBtn);
    const approveBtn = document.createElement('button');
    approveBtn.id = 'vibescript-diff-approve';
    approveBtn.textContent = 'Approve';
    footer.appendChild(approveBtn);
    overlay.appendChild(footer);

    container.appendChild(overlay);

    const styleEl = document.createElement('style');
    styleEl.id = 'vibescript-diff-styles';
    styleEl.textContent =
      '#vibescript-diff-overlay{position:absolute;inset:0;z-index:100;background:#fff;display:flex;flex-direction:column}' +
      '#vibescript-diff-header{display:flex;justify-content:space-between;align-items:center;padding:8px 16px;background:#f6f8fa;border-bottom:1px solid #d0d7de;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px}' +
      '#vibescript-diff-filename{font-weight:600;color:#1f2328}' +
      '#vibescript-diff-stats{font-size:12px}' +
      '#vibescript-diff-container{flex:1;overflow:hidden}' +
      '#vibescript-diff-footer{display:flex;justify-content:flex-end;gap:8px;padding:8px 16px;border-top:1px solid #d0d7de}' +
      '#vibescript-diff-approve{background:#2da44e;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:600;font-size:13px;padding:6px 16px;border:none;border-radius:6px;cursor:pointer}' +
      '#vibescript-diff-approve:hover{background:#218838}' +
      '#vibescript-diff-reject{background:#cf222e;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:600;font-size:13px;padding:6px 16px;border:none;border-radius:6px;cursor:pointer}' +
      '#vibescript-diff-reject:hover{background:#a71d2a}';
    document.head.appendChild(styleEl);

    requestAnimationFrame(() => {
      const origModel = monaco.editor.createModel(original, lang);
      const modModel = monaco.editor.createModel(modified, lang);

      const diffEditor = monaco.editor.createDiffEditor(diffContainer, {
        renderSideBySide: true,
        readOnly: true,
        enableSplitViewResizing: false,
        originalEditable: false,
        contextmenu: false,
        scrollBeyondLastLine: false,
        fontSize: 12,
      });

      diffEditor.setModel({ original: origModel, modified: modModel });

      diffEditor.onDidUpdateDiff(() => {
        const changes = diffEditor.getLineChanges();
        let added = 0, deleted = 0;
        if (changes) {
          for (const c of changes) {
            if (c.originalEndLineNumber > 0) deleted += c.originalEndLineNumber - c.originalStartLineNumber + 1;
            if (c.modifiedEndLineNumber > 0) added += c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1;
          }
        }
        statsEl.textContent = '';
        const addSpan = document.createElement('span');
        addSpan.style.color = '#1a7f37';
        addSpan.textContent = '+'+added;
        statsEl.appendChild(addSpan);
        statsEl.appendChild(document.createTextNode(' '));
        const delSpan = document.createElement('span');
        delSpan.style.color = '#cf222e';
        delSpan.textContent = '-'+deleted;
        statsEl.appendChild(delSpan);
      });

      const cleanup = () => {
        diffEditor.dispose();
        origModel.dispose();
        modModel.dispose();
        overlay.remove();
        const s = document.getElementById('vibescript-diff-styles');
        if (s) s.remove();
        _diffOverlayCleanup = null;
      };

      const finish = (approved) => {
        cleanup();
        window.postMessage({
          source: 'vibescript-inject',
          action: 'DIFF_RESULT',
          payload: { requestId, approved, output: approved ? 'Applied' : 'Rejected' }
        }, '*');
      };

      rejectBtn.onclick = () => finish(false);
      approveBtn.onclick = async () => {
        if (onApprove) {
          approveBtn.disabled = true;
          approveBtn.textContent = 'Creating...';
          const ok = await onApprove();
          if (ok) {
            finish(true);
          } else {
            // onApprove already sent a failure DIFF_RESULT; just cleanup overlay
            cleanup();
          }
        } else {
          editor.executeEdits('vibescript', [{ range, text: replaceText, forceMoveMarkers: true }]);
          finish(true);
        }
      };

      _diffOverlayCleanup = () => {
        cleanup();
        window.postMessage({
          source: 'vibescript-inject',
          action: 'DIFF_RESULT',
          payload: { requestId, approved: false, output: 'Cancelled' }
        }, '*');
      };
    });
  }

  // Handle messages from the content script
  window.addEventListener('message', (event) => {
    // Only accept messages from our content script
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

        editor.executeEdits('vibescript', [{
          range: model.getFullModelRange(),
          text: event.data.payload.code,
          forceMoveMarkers: true
        }]);
        break;
      }

      case 'INSERT_AT_CURSOR': {
        if (!editor) return;
        const position = editor.getPosition();
        if (!position) return;

        editor.executeEdits('vibescript', [{
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          text: event.data.payload.code,
          forceMoveMarkers: true
        }]);
        break;
      }

      case 'REPLACE_SELECTION': {
        if (!editor) return;
        const selection = editor.getSelection();
        if (!selection) return;

        editor.executeEdits('vibescript', [{
          range: selection,
          text: event.data.payload.code,
          forceMoveMarkers: true
        }]);
        break;
      }

      case 'LIST_FILES': {
        const editorsList = monaco.editor.getEditors();
        const files = editorsList.map((e) => {
          const model = e.getModel();
          return {
            name: model ? model.uri.path.replace(/^\//, '') : 'untitled',
            language: model ? model.getLanguageId() : 'unknown',
            isActive: e.hasWidgetFocus()
          };
        });
        window.postMessage({
          source: 'vibescript-inject',
          action: 'LIST_FILES_RESULT',
          payload: { requestId: event.data.payload?.requestId, files }
        }, '*');
        break;
      }

      case 'READ_FILE_BY_NAME': {
        const filename = event.data.payload?.filename;
        const reqId = event.data.payload?.requestId;
        const allEditors = monaco.editor.getEditors();
        const target = allEditors.find((e) => {
          const model = e.getModel();
          return model && model.uri.path.includes(filename);
        });
        if (target) {
          target.focus();
          const ctx = contextFromEditor(target);
          window.postMessage({
            source: 'vibescript-inject',
            action: 'CODE_RESULT',
            payload: { requestId: reqId, context: ctx }
          }, '*');
        } else {
          window.postMessage({
            source: 'vibescript-inject',
            action: 'CODE_RESULT',
            payload: { requestId: reqId, context: null }
          }, '*');
        }
        break;
      }

      case 'EDIT_FILE_REVIEW': {
        if (!editor) {
          window.postMessage({ source: 'vibescript-inject', action: 'DIFF_RESULT',
            payload: { requestId: event.data.payload?.requestId, approved: false, output: 'No active editor' } }, '*');
          return;
        }
        const model = editor.getModel();
        if (!model) {
          window.postMessage({ source: 'vibescript-inject', action: 'DIFF_RESULT',
            payload: { requestId: event.data.payload?.requestId, approved: false, output: 'No active model' } }, '*');
          return;
        }

        const { search, replace, requestId } = event.data.payload;
        const matches = model.findMatches(search, undefined, false, true, null, false, 5);

        let range, original, modified, fileName;

        if (matches.length === 1) {
          range = matches[0].range;
          original = model.getValue();
          const startOff = model.getOffsetAt(range.getStartPosition());
          const endOff = model.getOffsetAt(range.getEndPosition());
          modified = original.slice(0, startOff) + replace + original.slice(endOff);
        } else if (matches.length > 1) {
          const positions = matches.map(m => `line ${m.range.startLineNumber}`);
          window.postMessage({ source: 'vibescript-inject', action: 'DIFF_RESULT',
            payload: { requestId, approved: false, output: `Ambiguous: ${matches.length} matches at ${positions.join(', ')}` } }, '*');
          return;
        } else {
          const fullText = model.getValue();
          if (fullText.includes(search)) {
            modified = fullText.replace(search, replace);
            if (modified !== fullText) {
              range = model.getFullModelRange();
              original = fullText;
            } else {
              window.postMessage({ source: 'vibescript-inject', action: 'DIFF_RESULT',
                payload: { requestId, approved: false, output: 'No match found' } }, '*');
              return;
            }
          } else {
            window.postMessage({ source: 'vibescript-inject', action: 'DIFF_RESULT',
              payload: { requestId, approved: false, output: 'No match found' } }, '*');
            return;
          }
        }

        _showDiffOverlay(editor, original, modified, range, replace, requestId);
        break;
      }


      case 'EDIT_FILE_REVIEW_CANCEL': {
        if (_diffOverlayCleanup) _diffOverlayCleanup();
        break;
      }



      case 'EDIT_FILE': {
        if (!editor) return;
        const model = editor.getModel();
        if (!model) return;
        const { search, replace, requestId } = event.data.payload;

        // Use Monaco's findMatches for precise, unique match
        const matches = model.findMatches(search, undefined, false, true, null, false, 5);

        if (matches.length === 0) {
          // Fallback: try String.replace in case findMatches API is incompatible
          const fullText = model.getValue();
          if (fullText.includes(search)) {
            const newText = fullText.replace(search, replace);
            if (newText !== fullText) {
              editor.executeEdits('vibescript', [{
                range: model.getFullModelRange(),
                text: newText,
                forceMoveMarkers: true
              }]);
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
          const positions = matches.map(m => `line ${m.range.startLineNumber}`);
          window.postMessage({
            source: 'vibescript-inject',
            action: 'EDIT_FILE_RESULT',
            payload: {
              requestId, success: false, matchCount: matches.length,
              error: `Found ${matches.length} matches at ${positions.join(', ')}. Provide more surrounding context to make the search unique.`
            }
          }, '*');
        } else {
          editor.executeEdits('vibescript', [{
            range: matches[0].range,
            text: replace,
            forceMoveMarkers: true
          }]);
          window.postMessage({
            source: 'vibescript-inject',
            action: 'EDIT_FILE_RESULT',
            payload: { requestId, success: true, matchCount: 1 }
          }, '*');
        }
        break;
      }
    }
  });

  // Wait for Monaco and register completions
  let completionsRegistered = false;
  function setupCompletions() {
    const monaco = getMonaco();
    if (!monaco || !monaco.languages || completionsRegistered) return;

    const languages = ['javascript', 'typescript'];
    
    languages.forEach((lang) => {
      try {
        monaco.languages.registerInlineCompletionsProvider(lang, {
          provideInlineCompletions: async (model, position, _context, _token) => {
            // Get text before cursor
            const textUntilPosition = model.getValueInRange({
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            });

            // We only trigger completion if there's some text or context
            if (textUntilPosition.trim().length === 0) {
              return { items: [] };
            }

            // Generate message ID to track this specific request
            const requestId = Math.random().toString(36).substring(7);

            // Send request to content script -> side panel -> LLM
            window.postMessage({
              source: 'vibescript-inject',
              action: 'REQUEST_COMPLETION',
              payload: {
                requestId,
                prefix: textUntilPosition,
                position: { line: position.lineNumber, col: position.column }
              }
            }, '*');

            // Wait for response with a timeout
            return new Promise((resolve) => {
              const handler = (e) => {
                if (
                  e.data?.source === 'vibescript-content' &&
                  e.data?.action === 'COMPLETION_RESULT' &&
                  e.data?.payload?.requestId === requestId
                ) {
                  window.removeEventListener('message', handler);
                  const suggestion = e.data.payload.suggestion;
                  
                  if (suggestion && suggestion.trim().length > 0) {
                    resolve({
                      items: [{
                        insertText: suggestion
                      }]
                    });
                  } else {
                    resolve({ items: [] });
                  }
                }
              };

              window.addEventListener('message', handler);

              // 4 second timeout to prevent blocking the editor
              setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve({ items: [] });
              }, 4000);
            });
          },
          freeInlineCompletions: () => {}
        });
      } catch (err) {
        console.error(`[VibeScript] Error registering completions for ${lang}:`, err);
      }
    });

    completionsRegistered = true;
    console.log('[VibeScript] Inline completion providers registered successfully');
  }

  // Poll for Monaco availability
  const interval = setInterval(() => {
    const monaco = getMonaco();
    if (monaco && monaco.editor && monaco.languages) {
      clearInterval(interval);
      setupCompletions();
      console.log('[VibeScript] Monaco editor bridge successfully initialized');
    }
  }, 1000);
})();
