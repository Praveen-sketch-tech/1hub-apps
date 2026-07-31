export interface ParsedFileItem {
  path: string;
  content: string;
}

export function parsePromptText(rawText: string): ParsedFileItem[] {
  const files: ParsedFileItem[] = [];
  const fileHeaderRegex = /=====\s*FILE:\s*(.*?)\s*=====/g;
  let match: RegExpExecArray | null;

  const matches: { path: string; index: number; headerLength: number }[] = [];

  while ((match = fileHeaderRegex.exec(rawText)) !== null) {
    matches.push({
      path: match[1].trim(),
      index: match.index,
      headerLength: match[0].length
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : rawText.length;
    let content = rawText.substring(current.index + current.headerLength, nextIndex);

    content = content.replace(/=====\s*END FILE\s*=====/gi, '').trim();

    if (content.startsWith('```')) {
      content = content.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');
    }

    files.push({
      path: current.path,
      content
    });
  }

  return files;
}
