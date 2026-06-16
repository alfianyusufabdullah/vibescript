import type { Tool } from '../types';
import { toolRegistry } from '../toolRegistry';

export const openFileTool: Tool = {
  name: 'open_file',
  description:
    'Switch the active Monaco editor file by filename. Use this before edit_file when the target file is not the currently active one. Returns the full content of the newly active file.',
  parameters: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Exact filename to open, e.g. "Code.gs" or "Utils.gs"',
      },
    },
    required: ['filename'],
  },
  async execute(args, ctx) {
    const filename = args.filename as string;

    const result = await ctx.editorStore.openFile(filename);

    if (!result) {
      return {
        toolCallId: '',
        name: 'open_file',
        success: false,
        output: '',
        error: 'Timed out waiting for file switch',
      };
    }

    if (!result.success) {
      return {
        toolCallId: '',
        name: 'open_file',
        success: false,
        output: '',
        error: result.error ?? 'Failed to open file',
      };
    }

    toolRegistry.invalidateCache();

    return {
      toolCallId: '',
      name: 'open_file',
      success: true,
      output: JSON.stringify({
        success: true,
        filename,
        code: result.context?.code ?? '',
        language: result.context?.language ?? '',
      }),
    };
  },
};
