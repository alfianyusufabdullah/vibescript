function countTableColumns(headerLine: string): number {
  const parts = headerLine.split('|');
  // Remove leading empty (before first |) and trailing empty (after last |)
  const cells = parts.slice(1, parts.length - 1);
  return cells.length;
}

function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return false;
  // All cells must contain only -, :, and whitespace
  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').every((cell) => /^[\s\-:]+$/.test(cell));
}

function fixIncompleteTable(text: string): string {
  const lines = text.split('\n');

  // Find the end of the trailing table block (skip trailing empty lines)
  let tableEnd = lines.length - 1;
  while (tableEnd >= 0 && lines[tableEnd].trim() === '') {
    tableEnd--;
  }

  if (tableEnd < 0 || !lines[tableEnd].trimStart().startsWith('|')) {
    return text;
  }

  // Find the start of this contiguous table block
  let tableStart = tableEnd;
  while (tableStart > 0 && lines[tableStart - 1].trimStart().startsWith('|')) {
    tableStart--;
  }

  const tableLines = lines.slice(tableStart, tableEnd + 1);
  const headerLine = tableLines[0];

  // State 1: header incomplete (no trailing |) — column count unknown, leave as-is
  if (!headerLine.trimEnd().endsWith('|')) {
    return text;
  }

  const colCount = countTableColumns(headerLine);
  if (colCount < 1) return text;

  const fixed = [...tableLines];

  // State 2: no separator row yet — inject synthetic one
  if (fixed.length < 2 || !isSeparatorRow(fixed[1])) {
    const sep = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
    fixed.splice(1, 0, sep);
  } else {
    // State 3: separator exists but may be incomplete — regenerate from scratch
    const sepCols = fixed[1].split('|').filter((_, i, a) => i > 0 && i < a.length - 1).length;
    if (sepCols < colCount) {
      fixed[1] = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
    }
  }

  // States 4 & 5: last row is a data row that is incomplete
  const lastRow = fixed[fixed.length - 1];
  if (!isSeparatorRow(lastRow)) {
    const endsWithPipe = lastRow.trimEnd().endsWith('|');
    const parts = lastRow.split('|');
    const cells = endsWithPipe ? parts.slice(1, -1) : parts.slice(1);
    const existingCols = cells.length;

    if (!endsWithPipe || existingCols < colCount) {
      while (cells.length < colCount) cells.push('');
      fixed[fixed.length - 1] = '| ' + cells.map((c) => c.trim()).join(' | ') + ' |';
    }
  }

  return [...lines.slice(0, tableStart), ...fixed, ...lines.slice(tableEnd + 1)].join('\n');
}

export function preprocessStreamingMarkdown(text: string, showCursor: boolean = false): string {
  if (!text) return showCursor ? '▋' : '';

  let processed = text;
  if (showCursor) {
    processed += '▋';
  }

  const matches = processed.match(/```/g);
  const count = matches ? matches.length : 0;

  if (count % 2 !== 0) {
    return processed + '\n```';
  }

  return fixIncompleteTable(processed);
}
