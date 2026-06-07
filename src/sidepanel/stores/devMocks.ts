import type { FileInfo } from './editorStore';
import type { MonacoEditorContext } from '../../shared/types';

export const DEV_MOCK_FILES: FileInfo[] = [
  { name: 'Code.gs', language: 'javascript', isActive: true },
  { name: 'Ui.html', language: 'html', isActive: false },
  { name: 'Helpers.gs', language: 'javascript', isActive: false },
];

const DEV_MOCK_CONTENTS: Record<string, Omit<MonacoEditorContext, 'position' | 'selection' | 'selectedText'>> = {
  'Code.gs': {
    code: `function doGet() {\n  return HtmlService.createHtmlOutputFromFile('Ui');\n}\n\nfunction getSpreadsheetData() {\n  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();\n  return sheet.getDataRange().getValues();\n}`,
    filename: 'Code.gs',
    language: 'javascript',
  },
  'Ui.html': {
    code: `<!DOCTYPE html>\n<html>\n  <head>\n    <base target="_top">\n  </head>\n  <body>\n    <h1>Hello VibeScript</h1>\n    <script>\n      console.log('App loaded');\n    </script>\n  </body>\n</html>`,
    filename: 'Ui.html',
    language: 'html',
  },
  'Helpers.gs': {
    code: `function formatName(name) {\n  return name ? name.toUpperCase() : 'ANONYMOUS';\n}\n\nfunction logAction(action) {\n  Logger.log('Action performed: ' + action);\n}`,
    filename: 'Helpers.gs',
    language: 'javascript',
  },
};

export function getDevMockContext(filename: string): MonacoEditorContext | null {
  const entry = DEV_MOCK_CONTENTS[filename];
  if (!entry) return null;
  return { ...entry, position: null, selection: null, selectedText: '' };
}
