import type { Tool } from '../types';

export const finishTool: Tool = {
  name: 'finish',
  description: 'Call this when the task is complete. Provide a summary of what was done for the user.',
  parameters: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Summary of all changes made and the final result' },
    },
    required: ['summary'],
  },
  async execute(args) {
    const summary = (args.summary as string) || '';
    return {
      toolCallId: '',
      name: 'finish',
      success: true,
      output: summary,
    };
  },
};
