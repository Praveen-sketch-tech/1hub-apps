import { ParsedFileItem } from '../types';

export function parsePromptText(rawText: string): ParsedFileItem[] {
  if (!rawText || !rawText.trim()) return [];

  const filesMap = new Map<string, string>();
  let match: RegExpExecArray | null;

  // Pattern 1: ===== FILE: path ===== ... ===== END FILE =====
  const pattern1 = /=====\s*FILE:\s*([^\s=]+)\s*=====\s*([\s\S]*?)(?:=====\s*END FILE\s*=====|$)/gi;
  while ((match = pattern1.exec(rawText)) !== null) {
    const filePath = match[1].trim();
    let content = match[2].trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }
    if (filePath && content) filesMap.set(filePath, content);
  }

  // Pattern 2: Claude XML tags <file path="src/apps/...">...</file>
  if (filesMap.size === 0) {
    const pattern2 = /<file\s+path=["']([^"']+)["']>\s*([\s\S]*?)<\/file>/gi;
    while ((match = pattern2.exec(rawText)) !== null) {
      const filePath = match[1].trim();
      let content = match[2].trim();
      if (content.startsWith('```')) {
        content = content.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
      }
      if (filePath && content) filesMap.set(filePath, content);
    }
  }

  // Pattern 3: Markdown headers (ChatGPT/Gemini/Claude)
  if (filesMap.size === 0) {
    const pattern3 = /(?:\*\*|###|#|FILE:|\/\/\s*File:)\s*`?(src\/[^\s`*:]+)`?\s*\n+```[a-zA-Z]*\n([\s\S]*?)```/gi;
    while ((match = pattern3.exec(rawText)) !== null) {
      const filePath = match[1].trim();
      const content = match[2].trim();
      if (filePath && content) filesMap.set(filePath, content);
    }
  }

  // Pattern 4: Top-line code comment e.g. ```tsx // src/apps/my-app/index.tsx
  if (filesMap.size === 0) {
    const pattern4 = /```[a-zA-Z]*\n\s*(?:\/\/|\/\*|<!--)\s*(src\/[^\s*:]+)(?:\*\/|-->)?\s*\n([\s\S]*?)```/gi;
    while ((match = pattern4.exec(rawText)) !== null) {
      const filePath = match[1].trim();
      const content = match[2].trim();
      if (filePath && content) filesMap.set(filePath, content);
    }
  }

  return Array.from(filesMap.entries()).map(([path, content]) => ({ path, content }));
}
