// Single-file inject script — must be self-contained (no ES module imports).
// chrome.scripting.executeScript({ world: 'MAIN' }) executes this as a classic script.
// Source modules are in inject-*.js for readability; this file is the bundled entry.

if (window.__vibescript_injected__) {
  // already loaded in this context — no-op
} else {
  window.__vibescript_injected__ = true;

  // ── Magic value constants ──────────────────────────────────────────────────
  const COMPLETION_REQUEST_TIMEOUT_MS = 4000;
  const EDITOR_POLL_LIMIT = 30;
  const EDITOR_POLL_INTERVAL_MS = 2000;
  const FILE_POLL_TIMEOUT_MS = 3000;
  const FILE_POLL_INTERVAL_MS = 200;
  const MONACO_HEARTBEAT_INTERVAL_MS = 15000;
  const MAX_Z_INDEX = 2147483647;
  const PILL_VERTICAL_OFFSET_PX = 38;
  const DEFAULT_LINE_TOP_PX = 100;
  const DEFAULT_NODE_WIDTH_PX = 500;
  const PILL_BG_COLOR = '#18181b';
  const PILL_BG_HOVER_COLOR = '#27272a';
  const COLOR_APPROVE = '#2da44e';
  const COLOR_APPROVE_HOVER = '#218838';
  const COLOR_REJECT = '#cf222e';
  const COLOR_REJECT_HOVER = '#a71d2a';

  /**
   * Logs to the console and forwards the entry to the sidepanel diagnostics
   * panel via a DIAGNOSTICS_LOG postMessage.
   *
   * @param {string} message
   * @param {'info'|'warn'|'error'|'success'} [type='info']
   */
  function logDiagnostics(message, type = 'info') {
    console.log(`[VibeScript Inject] ${message}`);
    window.postMessage({
      source: 'vibescript-inject',
      action: 'DIAGNOSTICS_LOG',
      payload: { message, type }
    }, '*');
  }

  const state = {
    fileModelMap: new Map(),
    diffOverlayCleanup: null,
  };

  function getMonaco() { return window.monaco; }

  function getActiveEditor() {
    const monaco = getMonaco();
    if (!monaco || !monaco.editor) return null;
    const editors = monaco.editor.getEditors();
    return editors.find((e) => e.hasWidgetFocus()) || editors[0] || null;
  }

  function getActiveFilename(model) {
    if (!model) return 'Code.gs';
    for (const [name, m] of state.fileModelMap.entries()) {
      if (m === model) return name;
    }
    try {
      const fileList =
        document.querySelector('ul[role="listbox"][aria-label="Project files"]') ||
        (window.parent !== window ? window.parent.document.querySelector('ul[role="listbox"][aria-label="Project files"]') : null);
      if (fileList) {
        const activeItem =
          fileList.querySelector('li[role="option"][aria-selected="true"]') ||
          fileList.querySelector('li[role="option"].UeVsd');
        if (activeItem) {
          const name = activeItem.getAttribute('aria-label');
          if (name && !name.startsWith('File operations')) return name;
        }
      }
    } catch (e) { /* cross-origin or missing */ }
    if (model.uri) {
      const name = model.uri.path.replace(/^\//, '');
      if (name && isNaN(Number(name))) return name;
    }
    return 'Code.gs';
  }

  function contextFromEditor(editor) {
    const model = editor.getModel();
    if (!model) return null;
    const code = editor.getValue();
    const language = model.getLanguageId();
    const position = editor.getPosition();
    const selection = editor.getSelection();
    const selectedText = selection ? model.getValueInRange(selection) : '';
    const filename = getActiveFilename(model);
    return {
      code, filename, language,
      position: position ? { line: position.lineNumber, col: position.column } : null,
      selection: selection
        ? {
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn,
          }
        : null,
      selectedText,
    };
  }

  function getEditorContext() {
    const editor = getActiveEditor();
    return editor ? contextFromEditor(editor) : null;
  }

  function langFromFilename(fn) {
    const fileExtension = fn.split('.').pop();
    const map = {
      gs: 'javascript', js: 'javascript', ts: 'typescript',
      html: 'html', css: 'css', json: 'json', md: 'markdown',
    };
    return map[fileExtension] || 'javascript';
  }

  function generateRequestId() {
    return Math.random().toString(36).substring(7);
  }

  function isValidFileName(name) {
    return name &&
      !name.includes('output') &&
      !name.includes('terminal') &&
      !name.startsWith('inmemory');
  }

  function postDiffResult(requestId, approved, output) {
    window.postMessage({
      source: 'vibescript-inject',
      action: 'DIFF_RESULT',
      payload: { requestId, approved, output },
    }, '*');
  }

  function disposeDiffResources(diffEditor, origModel, modModel) {
    if (diffEditor) {
      try { diffEditor.dispose(); } catch (e) {}
    }
    if (origModel && !origModel.isDisposed()) {
      try { origModel.dispose(); } catch (e) {}
    }
    if (modModel && !modModel.isDisposed()) {
      try { modModel.dispose(); } catch (e) {}
    }
  }

  /**
   * Mounts an inline diff editor over the Monaco container for the user to
   * approve or reject a proposed change before it is applied.
   *
   * Settles the review by posting a `DIFF_RESULT` message to the window:
   * - Approve: applies `replaceText` at `range` via `editor.executeEdits`, posts approved=true.
   * - Reject / programmatic cancel: posts approved=false without touching the model.
   *
   * @param {object} editor        Active Monaco editor instance.
   * @param {string} original      Original text (left side of the diff).
   * @param {string} modified      Proposed text (right side of the diff).
   * @param {object} range         Monaco Range for the edit applied on approval.
   * @param {string} replaceText   Exact replacement passed to executeEdits.
   * @param {string} requestId     Correlation ID matched by editorStore.editFileWithReview.
   * @param {string} [optFilename] Display name override in the diff header.
   * @param {Function} [onApprove] Async callback; if provided, runs instead of executeEdits.
   */
  const OVERLAY_STYLES =
    '#vibescript-diff-overlay{position:absolute;inset:0;z-index:100;background:#fff;display:flex;flex-direction:column}' +
    '#vibescript-diff-header{display:flex;justify-content:space-between;align-items:center;padding:8px 16px;background:#f6f8fa;border-bottom:1px solid #d0d7de;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px}' +
    '#vibescript-diff-filename{font-weight:600;color:#1f2328}' +
    '#vibescript-diff-stats{font-size:12px}' +
    '#vibescript-diff-container{flex:1;overflow:hidden}' +
    '#vibescript-diff-footer{display:flex;justify-content:flex-end;gap:8px;padding:8px 16px;border-top:1px solid #d0d7de}' +
    `#vibescript-diff-approve{background:${COLOR_APPROVE};color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:600;font-size:13px;padding:6px 16px;border:none;border-radius:6px;cursor:pointer}` +
    `#vibescript-diff-approve:hover{background:${COLOR_APPROVE_HOVER}}` +
    `#vibescript-diff-reject{background:${COLOR_REJECT};color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:600;font-size:13px;padding:6px 16px;border:none;border-radius:6px;cursor:pointer}` +
    `#vibescript-diff-reject:hover{background:${COLOR_REJECT_HOVER}}`;

  function showDiffOverlay(editor, original, modified, range, replaceText, requestId, optFilename, onApprove) {
    const monaco = getMonaco();
    const model = editor.getModel();
    if (!model) return;

    if (state.diffOverlayCleanup) {
      state.diffOverlayCleanup();
      state.diffOverlayCleanup = null;
    }
    const existingOverlay = document.getElementById('vibescript-diff-overlay');
    if (existingOverlay) existingOverlay.remove();
    const existingStyles = document.getElementById('vibescript-diff-styles');
    if (existingStyles) existingStyles.remove();

    const fileName = optFilename || (model.uri ? model.uri.path.replace(/^\//, '') : 'untitled');
    const lang = optFilename ? langFromFilename(optFilename) : model.getLanguageId();
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
    styleEl.textContent = OVERLAY_STYLES;
    document.head.appendChild(styleEl);

    let diffEditor = null, origModel = null, modModel = null, disposed = false;

    state.diffOverlayCleanup = () => {
      if (disposed) return;
      disposed = true;
      overlay.remove();
      const s = document.getElementById('vibescript-diff-styles');
      if (s) s.remove();
      disposeDiffResources(diffEditor, origModel, modModel);
      state.diffOverlayCleanup = null;
      postDiffResult(requestId, false, 'Cancelled');
    };

    requestAnimationFrame(() => {
      if (disposed) return;
      origModel = monaco.editor.createModel(original, lang);
      modModel = monaco.editor.createModel(modified, lang);
      diffEditor = monaco.editor.createDiffEditor(diffContainer, {
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
            if (c.originalEndLineNumber > 0) {
              deleted += c.originalEndLineNumber - c.originalStartLineNumber + 1;
            }
            if (c.modifiedEndLineNumber > 0) {
              added += c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1;
            }
          }
          if (changes.length > 0) {
            const first = changes[0];
            const line = first.modifiedStartLineNumber || first.modifiedEndLineNumber || 1;
            diffEditor.getModifiedEditor().revealLineInCenter(line);
          }
        }
        statsEl.textContent = '';
        const addSpan = document.createElement('span');
        addSpan.style.color = '#1a7f37';
        addSpan.textContent = `+${added}`;
        statsEl.appendChild(addSpan);
        statsEl.appendChild(document.createTextNode(' '));
        const delSpan = document.createElement('span');
        delSpan.style.color = COLOR_REJECT;
        delSpan.textContent = `-${deleted}`;
        statsEl.appendChild(delSpan);
      });

      const cleanupDiffEditor = () => {
        if (disposed) return;
        disposed = true;
        overlay.remove();
        const s = document.getElementById('vibescript-diff-styles');
        if (s) s.remove();
        disposeDiffResources(diffEditor, origModel, modModel);
        state.diffOverlayCleanup = null;
      };

      const settleDiffReview = (approved) => {
        cleanupDiffEditor();
        postDiffResult(requestId, approved, approved ? 'Applied' : 'Rejected');
      };

      rejectBtn.onclick = () => settleDiffReview(false);
      approveBtn.onclick = async () => {
        if (onApprove) {
          approveBtn.disabled = true;
          approveBtn.textContent = 'Creating...';
          try {
            const ok = await onApprove();
            settleDiffReview(!!ok);
          } catch (e) {
            console.error('[VibeScript] onApprove error:', e);
            settleDiffReview(false);
          }
        } else {
          try {
            editor.executeEdits('vibescript', [{ range, text: replaceText, forceMoveMarkers: true }]);
            settleDiffReview(true);
          } catch (e) {
            console.error('[VibeScript] executeEdits error:', e);
            settleDiffReview(false);
          }
        }
      };
    });
  }

  let completionsRegistered = false;

  function setupCompletions() {
    const monaco = getMonaco();
    if (!monaco || !monaco.languages || completionsRegistered) return;

    ['javascript', 'typescript'].forEach((lang) => {
      try {
        monaco.languages.registerInlineCompletionsProvider(lang, {
          provideInlineCompletions: async (model, position) => {
            const textUntilPosition = model.getValueInRange({
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            });
            if (textUntilPosition.trim().length === 0) return { items: [] };
            const requestId = generateRequestId();
            window.postMessage({
              source: 'vibescript-inject',
              action: 'REQUEST_COMPLETION',
              payload: {
                requestId,
                prefix: textUntilPosition,
                position: { line: position.lineNumber, col: position.column },
              },
            }, '*');
            return new Promise((resolve) => {
              const handler = (e) => {
                if (
                  e.data?.source === 'vibescript-content' &&
                  e.data?.action === 'COMPLETION_RESULT' &&
                  e.data?.payload?.requestId === requestId
                ) {
                  window.removeEventListener('message', handler);
                  const s = e.data.payload.suggestion;
                  resolve(s && s.trim() ? { items: [{ insertText: s }] } : { items: [] });
                }
              };
              window.addEventListener('message', handler);
              setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve({ items: [] });
              }, COMPLETION_REQUEST_TIMEOUT_MS);
            });
          },
          freeInlineCompletions: () => {},
        });
      } catch (err) {
        console.error(`[VibeScript] Error registering completions for ${lang}:`, err);
      }
    });

    completionsRegistered = true;
    logDiagnostics('Inline completion providers registered successfully', 'success');
  }

  let selectionPill = null;
  const attachedEditors = new WeakSet();

  function hideFloatingPill() {
    if (selectionPill) {
      selectionPill.remove();
      selectionPill = null;
    }
  }

  function showFloatingPill(editor, selection) {
    try {
      const monaco = getMonaco();
      if (!monaco) return;
      const position = new monaco.Position(selection.endLineNumber, selection.endColumn);
      let scrolledPos = null;
      try {
        if (typeof editor.getScrolledVisiblePosition === 'function') {
          scrolledPos = editor.getScrolledVisiblePosition(position);
        }
      } catch (e) {}
      const domNode = editor.getDomNode();
      if (!domNode) return;
      if (!scrolledPos) {
        const topOfLine = typeof editor.getTopForLineNumber === 'function'
          ? editor.getTopForLineNumber(position.lineNumber)
          : DEFAULT_LINE_TOP_PX;
        const editorScrollTop = typeof editor.getScrollTop === 'function'
          ? editor.getScrollTop()
          : 0;
        scrolledPos = {
          top: topOfLine - editorScrollTop,
          left: (domNode.clientWidth || DEFAULT_NODE_WIDTH_PX) / 2,
        };
      }
      const rect = domNode.getBoundingClientRect();
      const top = rect.top + scrolledPos.top - PILL_VERTICAL_OFFSET_PX;
      const left = rect.left + scrolledPos.left;

      if (!selectionPill) {
        selectionPill = document.createElement('button');
        selectionPill.id = 'vibescript-selection-pill';
        const svgNS = 'http://www.w3.org/2000/svg';
        const svgEl = document.createElementNS(svgNS, 'svg');
        svgEl.setAttribute('width', '11');
        svgEl.setAttribute('height', '11');
        svgEl.setAttribute('viewBox', '0 0 24 24');
        svgEl.setAttribute('fill', 'none');
        svgEl.setAttribute('stroke', 'currentColor');
        svgEl.setAttribute('stroke-width', '3');
        svgEl.setAttribute('stroke-linecap', 'round');
        svgEl.setAttribute('stroke-linejoin', 'round');
        Object.assign(svgEl.style, { marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' });
        const line1 = document.createElementNS(svgNS, 'line');
        line1.setAttribute('x1', '12');
        line1.setAttribute('y1', '5');
        line1.setAttribute('x2', '12');
        line1.setAttribute('y2', '19');
        svgEl.appendChild(line1);
        const line2 = document.createElementNS(svgNS, 'line');
        line2.setAttribute('x1', '5');
        line2.setAttribute('y1', '12');
        line2.setAttribute('x2', '19');
        line2.setAttribute('y2', '12');
        svgEl.appendChild(line2);
        const spanEl = document.createElement('span');
        spanEl.textContent = 'Attach to VibeScript';
        Object.assign(spanEl.style, { verticalAlign: 'middle' });
        selectionPill.appendChild(svgEl);
        selectionPill.appendChild(spanEl);

        // Position and layout
        Object.assign(selectionPill.style, {
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          zIndex: String(MAX_Z_INDEX),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        });

        // Appearance
        Object.assign(selectionPill.style, {
          padding: '5px 12px',
          backgroundColor: PILL_BG_COLOR,
          color: '#fafafa',
          border: `1px solid ${PILL_BG_HOVER_COLOR}`,
          borderRadius: '9999px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.16), 0 2px 4px rgba(0,0,0,0.08)',
          cursor: 'pointer',
        });

        // Typography and animation
        Object.assign(selectionPill.style, {
          fontSize: '11px',
          fontWeight: '600',
          fontFamily: 'Outfit, system-ui, -apple-system, sans-serif',
          lineHeight: '1.2',
          transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.1s ease',
          transform: 'translate(-50%, 0) scale(1)',
          opacity: '1',
        });

        selectionPill.onmouseenter = () => {
          selectionPill.style.backgroundColor = PILL_BG_HOVER_COLOR;
          selectionPill.style.transform = 'translate(-50%, -2px) scale(1.02)';
        };
        selectionPill.onmouseleave = () => {
          selectionPill.style.backgroundColor = PILL_BG_COLOR;
          selectionPill.style.transform = 'translate(-50%, 0) scale(1)';
        };
        document.body.appendChild(selectionPill);
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
        window.postMessage({
          source: 'vibescript-inject',
          action: 'ATTACH_SELECTION',
          payload: {
            filename,
            content: model.getValueInRange(selection),
            startLine: selection.startLineNumber,
            endLine: selection.endLineNumber,
          },
        }, '*');
        hideFloatingPill();
      };
    } catch (err) {
      logDiagnostics(`[Pill] Exception in showFloatingPill: ${err.message}`, 'error');
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
          const sel = e.selection;
          if (sel && !sel.isEmpty()) {
            showFloatingPill(editor, sel);
          } else {
            hideFloatingPill();
          }
        } catch (err) {
          logDiagnostics(`[Event] Error in onDidChangeCursorSelection: ${err.message}`, 'error');
        }
      });
      editor.onDidScrollChange(() => hideFloatingPill());
    }

    monaco.editor.getEditors().forEach(hookEditor);
    monaco.editor.onDidCreateEditor((editor) => {
      logDiagnostics('onDidCreateEditor fired.');
      hookEditor(editor);
    });

    let pollCount = 0;
    const pollId = setInterval(() => {
      pollCount++;
      const m = window.monaco;
      if (m && m.editor) m.editor.getEditors().forEach(hookEditor);
      if (pollCount >= EDITOR_POLL_LIMIT) {
        clearInterval(pollId);
        console.warn(`[VibeScript] Editor polling stopped after ${EDITOR_POLL_LIMIT} attempts`);
      }
    }, EDITOR_POLL_INTERVAL_MS);

    document.addEventListener('mousedown', (e) => {
      if (selectionPill && !selectionPill.contains(e.target)) {
        setTimeout(() => {
          const editor = getActiveEditor();
          if (editor) {
            const sel = editor.getSelection();
            if (!sel || sel.isEmpty()) hideFloatingPill();
          } else {
            hideFloatingPill();
          }
        }, 100);
      }
    });
  }

  function setupMessageHandler() {
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
            payload: { requestId, context: ctx },
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

          function queryFiles() {
            var result = [];
            state.fileModelMap.clear();
            try {
              var fileList =
                document.querySelector('ul[role="listbox"][aria-label="Project files"]') ||
                (window.parent !== window ? window.parent.document.querySelector('ul[role="listbox"][aria-label="Project files"]') : null);
              if (fileList) {
                var items = fileList.querySelectorAll('li[role="option"]');
                var models = monaco && monaco.editor ? monaco.editor.getModels() : [];
                var modelIdx = 0;
                items.forEach(function(item) {
                  var name = item.getAttribute('aria-label');
                  if (name && !name.startsWith('File operations')) {
                    var isSelected = item.getAttribute('aria-selected') === 'true' || item.classList.contains('UeVsd');
                    result.push({
                      name: name,
                      language: name.endsWith('.html') || name.endsWith('.htm') ? 'html' : 'javascript',
                      isActive: isSelected,
                    });
                    if (modelIdx < models.length) state.fileModelMap.set(name, models[modelIdx]);
                    modelIdx++;
                  }
                });
              }
            } catch (e) {
              logDiagnostics(`DOM file list extraction failed: ${e.message}`, 'warn');
            }

            if (result.length === 0 && monaco && monaco.editor) {
              var activeEditor = getActiveEditor();
              var activeModel = activeEditor ? activeEditor.getModel() : null;
              result = monaco.editor.getModels()
                .map(function(m) {
                  var path = m.uri.path;
                  var name = path.replace(/^\//, '');
                  return {
                    name: name || 'untitled',
                    language: m.getLanguageId(),
                    isActive: activeModel ? activeModel.uri.toString() === m.uri.toString() : false,
                  };
                })
                .filter(function(f) { return isValidFileName(f.name) && isNaN(Number(f.name)); });
            }
            return result;
          }

          var listFilesStart = Date.now();
          function pollForFiles() {
            var files = queryFiles();
            if (files.length > 0 || (Date.now() - listFilesStart) >= FILE_POLL_TIMEOUT_MS) {
              window.postMessage({
                source: 'vibescript-inject',
                action: 'LIST_FILES_RESULT',
                payload: { requestId: listFilesRequestId, files: files },
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
                },
              },
            }, '*');
          } else {
            try {
              const escapedName = filename.replace(/"/g, '\\"');
              const fileItem =
                document.querySelector(`li[role="option"][aria-label="${escapedName}"]`) ||
                (window.parent !== window ? window.parent.document.querySelector(`li[role="option"][aria-label="${escapedName}"]`) : null);
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
                          },
                        },
                      }, '*');
                      return;
                    }
                  }
                  window.postMessage({
                    source: 'vibescript-inject',
                    action: 'CODE_RESULT',
                    payload: { requestId: reqId, context: null },
                  }, '*');
                }, FILE_POLL_INTERVAL_MS);
              } else {
                window.postMessage({
                  source: 'vibescript-inject',
                  action: 'CODE_RESULT',
                  payload: { requestId: reqId, context: null },
                }, '*');
              }
            } catch (e) {
              logDiagnostics(`DOM click for "${filename}" failed: ${e.message}`, 'warn');
              window.postMessage({
                source: 'vibescript-inject',
                action: 'CODE_RESULT',
                payload: { requestId: reqId, context: null },
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
            postDiffResult(requestId, false, `Ambiguous: ${matches.length} matches at ${positions.join(', ')}`);
            return;
          } else {
            const fullText = model.getValue();
            if (fullText.includes(search)) {
              modified = fullText.replace(search, replace);
              if (modified !== fullText) {
                range = model.getFullModelRange();
                original = fullText;
              } else {
                postDiffResult(requestId, false, 'No match found');
                return;
              }
            } else {
              postDiffResult(requestId, false, 'No match found');
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
                  payload: { requestId, success: true, matchCount: 1 },
                }, '*');
                break;
              }
            }
            window.postMessage({
              source: 'vibescript-inject',
              action: 'EDIT_FILE_RESULT',
              payload: { requestId, success: false, error: 'No match found for the search text', matchCount: 0 },
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
                error: `Found ${matches.length} matches at ${positions.join(', ')}. Provide more surrounding context.`,
              },
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
              source: 'vibescript-inject',
              action: 'EDIT_FILE_RESULT',
              payload: { requestId, success: true, matchCount: 1 },
            }, '*');
          }
          break;
        }
      }
    });
  }

  try {
    logDiagnostics(`inject.js loaded in context: ${window.location.href}`);
    setupMessageHandler();

    let pollAttempts = 0;
    const MONACO_POLL_MAX = 60;

    const interval = setInterval(() => {
      try {
        pollAttempts++;
        const monaco = window.monaco;

        if (pollAttempts % 5 === 0) {
          logDiagnostics(`Polling for Monaco. Attempt ${pollAttempts}. Found: ${!!monaco}`, 'warn');
        }

        if (monaco && monaco.editor && monaco.languages) {
          clearInterval(interval);
          logDiagnostics('Monaco found! Setting up autocompletes and listeners...', 'success');
          setupCompletions();
          attachSelectionListeners();
          logDiagnostics('Monaco editor bridge successfully initialized', 'success');
          window.postMessage({ source: 'vibescript-inject', action: 'MONACO_READY' }, '*');
          // Heartbeat: re-register with background after SW restarts (clears tabEditorFrames)
          setInterval(function() {
            window.postMessage({ source: 'vibescript-inject', action: 'MONACO_READY' }, '*');
          }, MONACO_HEARTBEAT_INTERVAL_MS);
        } else if (pollAttempts >= MONACO_POLL_MAX) {
          clearInterval(interval);
          logDiagnostics(`Monaco polling stopped after ${pollAttempts} attempts — Monaco not found`, 'warn');
        }
      } catch (err) {
        logDiagnostics(`Error in polling loop: ${err.message}`, 'error');
      }
    }, 1000);
  } catch (err) {
    logDiagnostics(`Fatal script error during load: ${err.message}`, 'error');
  }
}
