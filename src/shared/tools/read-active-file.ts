import type { Tool } from '../types';

export const readActiveFileTool: Tool = {
  name: 'read_active_file',
  description: 'Read the currently active file content from the Monaco editor. Returns the full code, cursor position, and selection.',
  parameters: { type: 'object', properties: {}, required: [] },
  async execute(_args, ctx) {
    const context = await ctx.editorStore.fetchContext();
    return {
      toolCallId: '',
      name: 'read_active_file',
      success: !!context,
      output: context ? JSON.stringify(context) : 'No active editor',
    };
  },
};
