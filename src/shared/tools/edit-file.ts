import type { Tool } from '../types';

export const editFileTool: Tool = {
  name: 'edit_file',
  description:
    'Search for exact text in the active editor and replace it. SURGICAL USE ONLY: the replace argument must contain only the lines that actually change — do not regenerate surrounding code that stays the same. For inserting new code: search for the anchor line before the insertion point. For deleting: replace with empty string.',
  parameters: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'The exact text to find — must be unique in the file. Include 3–5 lines of context around the changed lines.' },
      replace: { type: 'string', description: 'Only the lines that change. Do not include unchanged surrounding code.' },
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

    if (result.approved === false) {
      if (result.output === 'Rejected') {
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
        success: false,
        output: '',
        error: result.output || 'Edit failed',
      };
    }

    if (result.approved !== true) {
      return {
        toolCallId: '',
        name: 'edit_file',
        success: false,
        output: result.output,
        error: result.output || 'Diff review did not return approval',
      };
    }

    const lineCount = replace.split('\n').length;
    const sizeNote = lineCount > 15
      ? ` [${lineCount} lines written — next edits should be smaller, one function at a time]`
      : '';
    return {
      toolCallId: '',
      name: 'edit_file',
      success: true,
      output: `Applied edit successfully.${sizeNote}`,
    };
  },
};
