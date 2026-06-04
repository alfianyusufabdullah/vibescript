/**
 * Sanitizes and preprocesses streaming markdown text.
 * Specifically, it detects unclosed code blocks (triple backticks) and
 * appends closing backticks so the markdown parser renders it correctly.
 * Optionally appends a blinking cursor indicator inside the block structure.
 */
export function preprocessStreamingMarkdown(text: string, showCursor: boolean = false): string {
  if (!text) return showCursor ? '▋' : '';

  let processed = text;
  if (showCursor) {
    processed += '▋';
  }

  // Count occurrences of triple backticks
  const matches = processed.match(/```/g);
  const count = matches ? matches.length : 0;

  // If the count is odd, there is an unclosed code block
  if (count % 2 !== 0) {
    return processed + '\n```';
  }

  return processed;
}
