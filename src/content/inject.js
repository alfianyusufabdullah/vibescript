(function () {
  if (window.__vibescript_injected__) return;
  window.__vibescript_injected__ = true;

  function logDiagnostics(message, type = 'info') {
    console.log('[VibeScript Inject] ' + message);
    window.postMessage({
      source: 'vibescript-inject',
      action: 'DIAGNOSTICS_LOG',
      payload: { message, type }
    }, '*');
  }

  try {
    logDiagnostics('inject.js loaded in context: ' + window.location.href);

    const getMonaco = () => window.monaco;
    const fileModelMap = new Map();

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
        const monaco = getMonaco();

        // Extract file names from DOM sidebar (Google Apps Script file tree)
        let files = [];
        fileModelMap.clear();
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
                  name: name,
                  language: name.endsWith('.html') || name.endsWith('.htm') ? 'html' : 'javascript',
                  isActive: isSelected
                });
                // Map file name to Monaco model by order (DOM order matches model order)
                if (modelIdx < models.length) {
                  fileModelMap.set(name, models[modelIdx]);
                }
                modelIdx++;
              }
            });
          }
        } catch (e) {
          logDiagnostics(`DOM file list extraction failed: ${e.message}`, 'warn');
        }

        // Fallback: Monaco model URIs if DOM parsing fails
        if (files.length === 0 && monaco && monaco.editor) {
          const activeEditor = getActiveEditor();
          const activeModel = activeEditor ? activeEditor.getModel() : null;
          const models = monaco.editor.getModels();
          files = models
            .map((model) => {
              const path = model.uri.path;
              const name = path.replace(/^\//, '');
              return {
                name: name || 'untitled',
                language: model.getLanguageId(),
                isActive: activeModel ? activeModel.uri.toString() === model.uri.toString() : false
              };
            })
            .filter(file => file.name && !file.name.includes('output') && !file.name.includes('terminal') && !file.name.startsWith('inmemory'));
        }

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

        // Look up model from fileModelMap (built by LIST_FILES) and read directly (no editor switch)
        const model = fileModelMap.get(filename);

        if (model) {
          const code = model.getValue();
          window.postMessage({
            source: 'vibescript-inject',
            action: 'CODE_RESULT',
            payload: { requestId: reqId, context: { code, language: model.getLanguageId(), position: null, selection: null, selectedText: '' } }
          }, '*');
        } else {
          // Fallback: try DOM click + active editor
          try {
            const fileItem = document.querySelector(`li[role="option"][aria-label="${filename.replace(/"/g, '\\"')}"]`);
            if (fileItem) {
              fileItem.click();
              setTimeout(() => {
                const editor = getActiveEditor();
                if (editor) {
                  const model = editor.getModel();
                  if (model) {
                    window.postMessage({
                      source: 'vibescript-inject',
                      action: 'CODE_RESULT',
                      payload: { requestId: reqId, context: { code: model.getValue(), language: model.getLanguageId(), position: null, selection: null, selectedText: '' } }
                    }, '*');
                    return;
                  }
                }
                window.postMessage({
                  source: 'vibescript-inject',
                  action: 'CODE_RESULT',
                  payload: { requestId: reqId, context: null }
                }, '*');
              }, 200);
            }
          } catch (e) {
            logDiagnostics(`DOM click for "${filename}" failed: ${e.message}`, 'warn');
          }
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

  // --- FLOATING CODE SELECTION PILL FOR CHAT ATTACHMENTS ---
  let selectionPill = null;
  const attachedEditors = new WeakSet();

  function showFloatingPill(editor, selection) {
    try {
      const selectionText = editor.getModel()?.getValueInRange(selection) || '';
      logDiagnostics(`[Pill] showFloatingPill triggered. selection: ${selection.startLineNumber}:${selection.startColumn} to ${selection.endLineNumber}:${selection.endColumn}, length: ${selectionText.length}`);

      const monaco = getMonaco();
      if (!monaco) {
        logDiagnostics('[Pill] Monaco not found in showFloatingPill', 'error');
        return;
      }

      // Use explicit Position object from selection coordinates
      const position = new monaco.Position(selection.endLineNumber, selection.endColumn);
      let scrolledPos = null;
      try {
        if (typeof editor.getScrolledVisiblePosition === 'function') {
          scrolledPos = editor.getScrolledVisiblePosition(position);
          logDiagnostics(`[Pill] getScrolledVisiblePosition returned: ${JSON.stringify(scrolledPos)}`);
        } else {
          logDiagnostics('[Pill] getScrolledVisiblePosition is not a function on editor', 'warn');
        }
      } catch (err) {
        logDiagnostics(`[Pill] Error calling getScrolledVisiblePosition: ${err.message}`, 'error');
      }

      const domNode = editor.getDomNode();
      if (!domNode) {
        logDiagnostics('[Pill] domNode is null/undefined', 'error');
        return;
      }

      if (!scrolledPos) {
        const topOfLine = typeof editor.getTopForLineNumber === 'function' ? editor.getTopForLineNumber(position.lineNumber) : 100;
        const editorScrollTop = typeof editor.getScrollTop === 'function' ? editor.getScrollTop() : 0;
        scrolledPos = {
          top: topOfLine - editorScrollTop,
          left: (domNode.clientWidth || 500) / 2
        };
        logDiagnostics(`[Pill] Calculated fallback scrolledPos: ${JSON.stringify(scrolledPos)}`);
      }

      const rect = domNode.getBoundingClientRect();
      const top = rect.top + scrolledPos.top - 38;
      const left = rect.left + scrolledPos.left;

      logDiagnostics(`[Pill] Calculated positioning: top=${top}, left=${left}, rectTop=${rect.top}, scrolledTop=${scrolledPos.top}`);

      if (!selectionPill) {
        selectionPill = document.createElement('button');
        selectionPill.id = 'vibescript-selection-pill';
        
        // Create SVG element programmatically to avoid Trusted Types error
        const svgNamespace = "http://www.w3.org/2000/svg";
        const svgEl = document.createElementNS(svgNamespace, "svg");
        svgEl.setAttribute("width", "11");
        svgEl.setAttribute("height", "11");
        svgEl.setAttribute("viewBox", "0 0 24 24");
        svgEl.setAttribute("fill", "none");
        svgEl.setAttribute("stroke", "currentColor");
        svgEl.setAttribute("stroke-width", "3");
        svgEl.setAttribute("stroke-linecap", "round");
        svgEl.setAttribute("stroke-linejoin", "round");
        Object.assign(svgEl.style, {
          marginRight: "4px",
          display: "inline-block",
          verticalAlign: "middle"
        });

        const line1 = document.createElementNS(svgNamespace, "line");
        line1.setAttribute("x1", "12");
        line1.setAttribute("y1", "5");
        line1.setAttribute("x2", "12");
        line1.setAttribute("y2", "19");
        svgEl.appendChild(line1);

        const line2 = document.createElementNS(svgNamespace, "line");
        line2.setAttribute("x1", "5");
        line2.setAttribute("y1", "12");
        line2.setAttribute("x2", "19");
        line2.setAttribute("y2", "12");
        svgEl.appendChild(line2);

        const spanEl = document.createElement("span");
        spanEl.textContent = "Attach to VibeScript";
        Object.assign(spanEl.style, {
          verticalAlign: "middle"
        });

        selectionPill.appendChild(svgEl);
        selectionPill.appendChild(spanEl);

        Object.assign(selectionPill.style, {
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          zIndex: '2147483647',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '5px 12px',
          backgroundColor: '#18181b',
          color: '#fafafa',
          border: '1px solid #27272a',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: '600',
          fontFamily: 'Outfit, system-ui, -apple-system, sans-serif',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.16), 0 2px 4px rgba(0,0,0,0.08)',
          transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.1s ease',
          transform: 'translate(-50%, 0) scale(1)',
          opacity: '1',
          lineHeight: '1.2'
        });

        selectionPill.onmouseenter = () => {
          selectionPill.style.backgroundColor = '#27272a';
          selectionPill.style.transform = 'translate(-50%, -2px) scale(1.02)';
        };
        selectionPill.onmouseleave = () => {
          selectionPill.style.backgroundColor = '#18181b';
          selectionPill.style.transform = 'translate(-50%, 0) scale(1)';
        };

        document.body.appendChild(selectionPill);
        logDiagnostics('[Pill] Appended floating selection pill to document body', 'success');
      } else {
        selectionPill.style.top = `${top}px`;
        selectionPill.style.left = `${left}px`;
        selectionPill.style.opacity = '1';
        selectionPill.style.transform = 'translate(-50%, 0) scale(1)';
      }

      selectionPill.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const model = editor.getModel();
        if (!model) return;

        const filename = model.uri ? model.uri.path.replace(/^\//, '') : 'untitled.gs';
        const selectedText = model.getValueInRange(selection);

        logDiagnostics(`[Pill] selectionPill clicked. Attaching selection: ${filename}`);

        window.postMessage({
          source: 'vibescript-inject',
          action: 'ATTACH_SELECTION',
          payload: {
            filename,
            content: selectedText,
            startLine: selection.startLineNumber,
            endLine: selection.endLineNumber
          }
        }, '*');

        hideFloatingPill();
      };
    } catch (err) {
      logDiagnostics(`[Pill] Exception in showFloatingPill: ${err.message}`, 'error');
    }
  }

  function hideFloatingPill() {
    if (selectionPill) {
      selectionPill.remove();
      selectionPill = null;
    }
  }

  function attachSelectionListeners() {
    const monaco = getMonaco();
    if (!monaco || !monaco.editor) return;

    function hookEditor(editor) {
      if (attachedEditors.has(editor)) return;
      attachedEditors.add(editor);
      logDiagnostics('Successfully hooked editor instance!', 'success');

      editor.onDidChangeCursorSelection((e) => {
        try {
          const selection = e.selection;
          const isEmpty = selection ? selection.isEmpty() : true;
          logDiagnostics(`[Event] onDidChangeCursorSelection fired. isEmpty: ${isEmpty}`);
          if (selection && !isEmpty) {
            showFloatingPill(editor, selection);
          } else {
            hideFloatingPill();
          }
        } catch (err) {
          logDiagnostics(`[Event] Error in onDidChangeCursorSelection: ${err.message}`, 'error');
        }
      });

      editor.onDidScrollChange(() => {
        hideFloatingPill();
      });
    }

    // Initial hook
    monaco.editor.getEditors().forEach(hookEditor);

    // Dynamic hooks on creation
    monaco.editor.onDidCreateEditor((editor) => {
      logDiagnostics('onDidCreateEditor fired.');
      hookEditor(editor);
    });

    // Defensive polling check for newly loaded/replaced editor instances
    setInterval(() => {
      const currentMonaco = getMonaco();
      if (currentMonaco && currentMonaco.editor) {
        currentMonaco.editor.getEditors().forEach(hookEditor);
      }
    }, 2000);

    document.addEventListener('mousedown', (e) => {
      if (selectionPill && !selectionPill.contains(e.target)) {
        setTimeout(() => {
          const editor = getActiveEditor();
          if (editor) {
            const selection = editor.getSelection();
            if (!selection || selection.isEmpty()) {
              hideFloatingPill();
            }
          } else {
            hideFloatingPill();
          }
        }, 100);
      }
    });
  }

  // Poll for Monaco availability
  let pollAttempts = 0;
  const interval = setInterval(() => {
    try {
      pollAttempts++;
      const monaco = getMonaco();
      
      if (pollAttempts % 5 === 0) {
        logDiagnostics(`Polling for Monaco. Attempt ${pollAttempts}. Found monaco: ${!!monaco}`, 'warn');
      }

      if (monaco && monaco.editor && monaco.languages) {
        clearInterval(interval);
        logDiagnostics('Monaco found! Setting up autocompletes and listeners...', 'success');
        setupCompletions();
        attachSelectionListeners();
        logDiagnostics('Monaco editor bridge successfully initialized', 'success');
        window.postMessage({
          source: 'vibescript-inject',
          action: 'MONACO_READY'
        }, '*');
      }
    } catch (err) {
      logDiagnostics('Error in polling loop: ' + err.message + '\n' + err.stack, 'error');
    }
  }, 1000);
  } catch (err) {
    logDiagnostics('Fatal script error during load: ' + err.message + '\n' + err.stack, 'error');
  }
})();
