import type { Tool } from '../types';

export const batchReadFilesTool: Tool = {
  name: 'batch_read_files',
  description:
    'Read multiple files simultaneously in parallel. More efficient than calling read_file_by_name multiple times when you need to read several files at once.',
  parameters: {
    type: 'object',
    properties: {
      filenames: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of filenames to read (e.g. ["Code.gs", "Utils.gs", "Index.html"])',
      },
    },
    required: ['filenames'],
  },
  async execute(args, ctx) {
    const filenames = args.filenames as string[];
    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      return {
        toolCallId: '',
        name: 'batch_read_files',
        success: false,
        output: '',
        error: 'Missing or empty filenames array',
      };
    }

    const results = await Promise.allSettled(
      filenames.map((filename) => ctx.editorStore.readFileByName(filename))
    );

    const output: Record<string, string | null> = {};
    let successCount = 0;

    for (let i = 0; i < filenames.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value) {
        output[filenames[i]] = r.value.code;
        successCount++;
      } else {
        output[filenames[i]] = null;
      }
    }

    return {
      toolCallId: '',
      name: 'batch_read_files',
      success: successCount > 0,
      output: JSON.stringify(output),
      error: successCount === 0 ? 'None of the requested files were found' : undefined,
    };
  },
};
