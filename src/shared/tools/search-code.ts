import type { Tool } from '../types';

export const searchCodeTool: Tool = {
  name: 'search_code',
  description:
    'Search for text or patterns across all open project files. Returns matching lines with surrounding context. Use this instead of reading each file manually when looking for a symbol, function, or pattern.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Text to search for (case-insensitive)',
      },
      context_lines: {
        type: 'number',
        description: 'Number of lines before/after each match to include for context (default: 2)',
      },
    },
    required: ['query'],
  },
  async execute(args, ctx) {
    const query = args.query as string;
    const contextLines = typeof args.context_lines === 'number' ? args.context_lines : 2;

    if (!query) {
      return {
        toolCallId: '',
        name: 'search_code',
        success: false,
        output: '',
        error: 'Missing query argument',
      };
    }

    const files = await ctx.editorStore.listOpenFiles();
    if (!files || files.length === 0) {
      return {
        toolCallId: '',
        name: 'search_code',
        success: true,
        output: 'No files open in the project.',
      };
    }

    // Read all files in parallel
    const fileContents = await Promise.allSettled(
      files.map((f) => ctx.editorStore.readFileByName(f.name))
    );

    const queryLower = query.toLowerCase();
    const resultParts: string[] = [];
    let totalMatches = 0;

    for (let fi = 0; fi < files.length; fi++) {
      const settled = fileContents[fi];
      if (settled.status !== 'fulfilled' || !settled.value) continue;

      const lines = settled.value.code.split('\n');
      const fileMatches: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].toLowerCase().includes(queryLower)) continue;

        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length - 1, i + contextLines);
        const snippet = lines.slice(start, end + 1).map((line, offset) => {
          const lineNum = start + offset + 1;
          const marker = start + offset === i ? '>' : ' ';
          return `${marker}${lineNum}: ${line}`;
        });
        fileMatches.push(snippet.join('\n'));
        totalMatches++;
      }

      if (fileMatches.length > 0) {
        resultParts.push(`\n=== ${files[fi].name} ===`);
        resultParts.push(fileMatches.join('\n---\n'));
      }
    }

    if (resultParts.length === 0) {
      return {
        toolCallId: '',
        name: 'search_code',
        success: true,
        output: `No matches found for "${query}" in ${files.length} file(s).`,
      };
    }

    return {
      toolCallId: '',
      name: 'search_code',
      success: true,
      output: `Found ${totalMatches} match(es) for "${query}" across ${files.length} file(s):\n${resultParts.join('\n')}`,
    };
  },
};
