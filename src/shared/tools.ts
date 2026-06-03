import type { ToolDefinition } from './types';

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    name: 'read_active_file',
    description: 'Read the currently active file content from the Monaco editor. Returns the full code, cursor position, and selection.',
    parameters: { type: 'object', properties: {}, required: [] }
  },


  {
    name: 'edit_file',
    description: 'Search for exact text in the active editor and replace it. Use for all edits: modifying code, inserting new code (search for anchor text), or deleting code (replace with empty string). This is the primary editing tool.',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'The exact text to search for in the editor' },
        replace: { type: 'string', description: 'The replacement text. Use empty string to delete.' }
      },
      required: ['search', 'replace']
    }
  },
  {
    name: 'list_open_files',
    description: 'List all open tabs/files in the Google Apps Script project.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'read_file_by_name',
    description: 'Switch to and read a specific file by name (e.g. "Code.gs", "Index.html"). Returns the full file content.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'The filename to read (e.g. "Code.gs")' }
      },
      required: ['filename']
    }
  },
  {
    name: 'finish',
    description: 'Call this when the task is complete. Provide a summary of what was done for the user.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Summary of all changes made and the final result' }
      },
      required: ['summary']
    }
  }
];
