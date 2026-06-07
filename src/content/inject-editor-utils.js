import { state } from './inject-state.js';

export const getMonaco = () => window.monaco;

export function getActiveEditor() {
  const monaco = getMonaco();
  if (!monaco || !monaco.editor) return null;
  const editors = monaco.editor.getEditors();
  return editors.find((e) => e.hasWidgetFocus()) || editors[0] || null;
}

export function getEditorContext() {
  const editor = getActiveEditor();
  return editor ? contextFromEditor(editor) : null;
}

export function getActiveFilename(model) {
  if (!model) return 'Code.gs';

  for (const [name, m] of state.fileModelMap.entries()) {
    if (m === model) return name;
  }

  try {
    const fileList = document.querySelector('ul[role="listbox"][aria-label="Project files"]');
    if (fileList) {
      const activeItem =
        fileList.querySelector('li[role="option"][aria-selected="true"]') ||
        fileList.querySelector('li[role="option"].UeVsd');
      if (activeItem) {
        const name = activeItem.getAttribute('aria-label');
        if (name && !name.startsWith('File operations')) return name;
      }
    }
  } catch (e) {
    // ignore
  }

  if (model.uri) {
    const name = model.uri.path.replace(/^\//, '');
    if (name && isNaN(Number(name))) return name;
  }

  return 'Code.gs';
}

export function contextFromEditor(editor) {
  const model = editor.getModel();
  if (!model) return null;

  const code = editor.getValue();
  const language = model.getLanguageId();
  const position = editor.getPosition();
  const selection = editor.getSelection();
  const selectedText = selection ? model.getValueInRange(selection) : '';
  const filename = getActiveFilename(model);

  return {
    code,
    filename,
    language,
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

export function langFromFilename(fn) {
  const fileExtension = fn.split('.').pop();
  const map = {
    gs: 'javascript', js: 'javascript', ts: 'typescript',
    html: 'html', css: 'css', json: 'json', md: 'markdown',
  };
  return map[fileExtension] || 'javascript';
}
