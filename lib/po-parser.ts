
export interface PoEntry {
  lineNumber: number;
  comment?: string;
  msgid: string;
  msgstr?: string;
  characterCount: number;
}

export interface ParsedPoFile {
  entries: PoEntry[];
  header: string;
  metadata: {
    totalEntries: number;
    hasHeader: boolean;
  };
}

export function parsePoFile(content: string): ParsedPoFile {
  const lines = content.split('\n');
  const entries: PoEntry[] = [];
  let currentEntry: Partial<PoEntry> | null = null;
  let header = '';
  let isInHeader = true;
  let currentField: 'comment' | 'msgid' | 'msgstr' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    const lineNumber = i + 1;

    // Skip empty lines
    if (line === '') {
      if (currentEntry) {
        finalizeEntry(currentEntry, entries);
        currentEntry = null;
        currentField = null;
      }
      continue;
    }

    // Handle header (first msgid should be empty string)
    if (isInHeader && line.startsWith('msgid ""')) {
      isInHeader = false;
      // Find the header content
      for (let j = i; j < lines.length; j++) {
        if (lines[j]?.trim().startsWith('msgstr')) {
          const headerMatch = lines[j]?.match(/msgstr\s+"(.*)"/);
          if (headerMatch) {
            header = headerMatch[1] || '';
          }
          break;
        }
      }
      continue;
    }

    // Skip header msgstr lines
    if (isInHeader && line.startsWith('msgstr')) {
      continue;
    }

    // Comments
    if (line.startsWith('#')) {
      if (!currentEntry) {
        currentEntry = { lineNumber };
      }
      currentEntry.comment = (currentEntry.comment || '') + line + '\n';
      currentField = 'comment';
      continue;
    }

    // msgid
    const msgidMatch = line.match(/^msgid\s+"(.*)"/);
    if (msgidMatch) {
      if (!currentEntry) {
        currentEntry = { lineNumber };
      }
      currentEntry.msgid = unescapePoString(msgidMatch[1] || '');
      currentField = 'msgid';
      isInHeader = false;
      continue;
    }

    // msgstr
    const msgstrMatch = line.match(/^msgstr\s+"(.*)"/);
    if (msgstrMatch) {
      if (currentEntry) {
        currentEntry.msgstr = unescapePoString(msgstrMatch[1] || '');
        currentField = 'msgstr';
      }
      continue;
    }

    // Continuation lines (quoted strings)
    const continuationMatch = line.match(/^"(.*)"/);
    if (continuationMatch && currentEntry && currentField) {
      const continuationText = unescapePoString(continuationMatch[1] || '');
      
      if (currentField === 'msgid') {
        currentEntry.msgid = (currentEntry.msgid || '') + continuationText;
      } else if (currentField === 'msgstr') {
        currentEntry.msgstr = (currentEntry.msgstr || '') + continuationText;
      } else if (currentField === 'comment') {
        currentEntry.comment = (currentEntry.comment || '') + line + '\n';
      }
      continue;
    }
  }

  // Finalize last entry
  if (currentEntry) {
    finalizeEntry(currentEntry, entries);
  }

  return {
    entries,
    header,
    metadata: {
      totalEntries: entries.length,
      hasHeader: header !== ''
    }
  };
}

function finalizeEntry(entry: Partial<PoEntry>, entries: PoEntry[]) {
  if (entry.msgid !== undefined) {
    const finalEntry: PoEntry = {
      lineNumber: entry.lineNumber || 0,
      comment: entry.comment?.trim(),
      msgid: entry.msgid,
      msgstr: entry.msgstr,
      characterCount: (entry.msgid || '').length
    };
    entries.push(finalEntry);
  }
}

function unescapePoString(str: string): string {
  return str
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
}

function escapePoString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}

export function generatePoFile(entries: PoEntry[], header: string = ''): string {
  let content = '';

  // Add header if present
  if (header) {
    content += 'msgid ""\n';
    content += `msgstr "${escapePoString(header)}"\n\n`;
  }

  entries.forEach((entry, index) => {
    // Add comments
    if (entry.comment) {
      content += entry.comment;
      if (!entry.comment.endsWith('\n')) {
        content += '\n';
      }
    }

    // Add msgid
    const msgidLines = splitLongString(entry.msgid);
    if (msgidLines.length === 1) {
      content += `msgid "${escapePoString(msgidLines[0] || '')}"\n`;
    } else {
      content += 'msgid ""\n';
      msgidLines.forEach(line => {
        content += `"${escapePoString(line)}"\n`;
      });
    }

    // Add msgstr
    const msgstr = entry.msgstr || '';
    const msgstrLines = splitLongString(msgstr);
    if (msgstrLines.length === 1) {
      content += `msgstr "${escapePoString(msgstrLines[0] || '')}"\n`;
    } else {
      content += 'msgstr ""\n';
      msgstrLines.forEach(line => {
        content += `"${escapePoString(line)}"\n`;
      });
    }

    // Add empty line between entries (except for last entry)
    if (index < entries.length - 1) {
      content += '\n';
    }
  });

  return content;
}

function splitLongString(str: string, maxLength: number = 79): string[] {
  if (str.length <= maxLength) {
    return [str];
  }

  const lines: string[] = [];
  const words = str.split(' ');
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).length <= maxLength) {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
