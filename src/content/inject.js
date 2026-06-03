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
    if (!editor) return null;
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
