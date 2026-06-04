import type { Tool } from '../types';

export const editFileTool: Tool = {
  name: 'edit_file',
  description:
    'Search for exact text in the active editor and replace it. Use for all edits: modifying code, inserting new code (search for anchor text), or deleting code (replace with empty string). This is the primary editing tool.',
  parameters: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'The exact text to search for in the editor' },
      replace: { type: 'string', description: 'The replacement text. Use empty string to delete.' },
    },
    required: ['search', 'replace'],
  },
  async execute(args, ctx) {
    const search = args.search as string;
    const replace = args.replace as string;

    if (!search || replace === undefined) {
      return {
        toolCallId: '',
        name: 'edit_file',
        success: false,
        output: '',
        error: 'Missing search or replace argument',
      };
    }

    const result = await ctx.editorStore.editFileWithReview(search, replace);

    if (!result.approved) {
      return {
        toolCallId: '',
        name: 'edit_file',
        success: false,
        output: result.output,
        error: 'USER_REJECTED',
      };
    }

    return {
      toolCallId: '',
      name: 'edit_file',
      success: true,
      output: `Applied edit: replaced "${search}" with "${replace}"`,
    };
  },
};
