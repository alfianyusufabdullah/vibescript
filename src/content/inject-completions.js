import { logDiagnostics } from './inject-log.js';

const COMPLETION_REQUEST_TIMEOUT_MS = 4000;

let completionsRegistered = false;

function generateRequestId() {
  return Math.random().toString(36).substring(7);
}

export function setupCompletions() {
  const monaco = window.monaco;
  if (!monaco || !monaco.languages || completionsRegistered) return;

  const languages = ['javascript', 'typescript'];

  languages.forEach((lang) => {
    try {
      monaco.languages.registerInlineCompletionsProvider(lang, {
        provideInlineCompletions: async (model, position, _context, _token) => {
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
                const suggestion = e.data.payload.suggestion;
                if (suggestion && suggestion.trim().length > 0) {
                  resolve({ items: [{ insertText: suggestion }] });
                } else {
                  resolve({ items: [] });
                }
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
