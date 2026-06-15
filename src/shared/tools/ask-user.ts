import type { Tool } from '../types';

export const askUserTool: Tool = {
  name: 'ask_user',
  description:
    'Pause and ask the user a question before continuing. Use when intent is ambiguous, there are multiple valid approaches, or a decision could significantly affect the outcome. Optionally provide choices the user can select from.',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The question to ask the user' },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of suggested choices. User can select one or provide a custom answer.',
      },
    },
    required: ['question'],
  },
  async execute(args, ctx) {
    const question = args.question as string;
    const options = args.options as string[] | undefined;

    if (!question) {
      return {
        toolCallId: '',
        name: 'ask_user',
        success: false,
        output: '',
        error: 'Missing question argument',
      };
    }

    const answer = await ctx.requestUserInput(question, options);

    if (answer === '__CANCELLED__') {
      return {
        toolCallId: '',
        name: 'ask_user',
        success: false,
        output: '',
        error: 'CANCELLED',
      };
    }

    return {
      toolCallId: '',
      name: 'ask_user',
      success: true,
      output: answer,
    };
  },
};
