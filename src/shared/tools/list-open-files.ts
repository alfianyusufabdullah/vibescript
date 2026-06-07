import type { Tool } from '../types';

export const listOpenFilesTool: Tool = {
  name: 'list_open_files',
  description: 'List all open tabs/files in the Google Apps Script project.',
  parameters: { type: 'object', properties: {}, required: [] },
  async execute(_args, ctx) {
    let files = await ctx.editorStore.listOpenFiles();
    if (files.length === 0) {
      // Monaco editor may still be loading models — wait and retry once
      await new Promise((resolve) => setTimeout(resolve, 2000));
      files = await ctx.editorStore.listOpenFiles();
    }
    return {
      toolCallId: '',
      name: 'list_open_files',
      success: true,
      output: JSON.stringify(files),
    };
  },
};
