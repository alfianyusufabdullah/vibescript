import type { Tool } from '../types';

export const readFileByNameTool: Tool = {
  name: 'read_file_by_name',
  description: 'Switch to and read a specific file by name (e.g. "Code.gs", "Index.html"). Returns the full file content.',
  parameters: {
    type: 'object',
    properties: {
      filename: { type: 'string', description: 'The filename to read (e.g. "Code.gs")' },
    },
    required: ['filename'],
  },
  async execute(args, ctx) {
    const filename = args.filename as string;
    if (!filename) {
      return {
        toolCallId: '',
        name: 'read_file_by_name',
        success: false,
        output: '',
        error: 'Missing filename argument',
      };
    }

    const context = await ctx.editorStore.readFileByName(filename);
    return {
      toolCallId: '',
      name: 'read_file_by_name',
      success: !!context,
      output: context ? JSON.stringify(context) : `File "${filename}" not found`,
    };
  },
};
