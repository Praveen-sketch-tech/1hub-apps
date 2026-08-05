import { ExtractedFile, AppConfig, ExportChunk } from '../types';

// Built from a marker constant at runtime (rather than hard-coded as a single
// literal delimiter string) so the export markers are assembled dynamically
// instead of appearing verbatim in this source file.
const MARKER = '=====';

export const wrapFileBlock = (path: string, content: string): string => {
  return `${MARKER} FILE: ${path} ${MARKER}\n${content}\n${MARKER} END FILE ${MARKER}\n\n`;
};

export const generateExportText = (files: ExtractedFile[], config: AppConfig, projectName: string): string => {
  let output = "";

  if (config.aiReadyMode) {
    output += `You are reviewing the codebase for project: ${projectName}.\n`;
    output += `Please analyze the following project structure and files.\n\n`;
    output += `PROJECT STRUCTURE:\n`;
    files.forEach(f => {
      output += `- ${f.path}\n`;
    });
    output += `\n=========================================\n\n`;
  }

  files.forEach(f => {
    output += wrapFileBlock(f.path, f.content);
  });

  return output;
};

export const generateSplitExportChunks = (
  files: ExtractedFile[],
  config: AppConfig,
  projectName: string
): ExportChunk[] => {
  const chunks: ExportChunk[] = [];
  let currentChunkContent = "";
  let currentSize = 0;
  let chunkIndex = 1;

  const header = config.aiReadyMode
    ? `You are reviewing the codebase for project: ${projectName}. This is part {PART} of the repository context.\n\n`
    : "";

  currentChunkContent = header.replace("{PART}", chunkIndex.toString());
  currentSize = currentChunkContent.length;

  for (const file of files) {
    const fileText = wrapFileBlock(file.path, file.content);

    if (currentSize + fileText.length > config.chunkSizeLimit && currentSize > header.length) {
      chunks.push({
        index: chunkIndex,
        filename: `${projectName}-context-${String(chunkIndex).padStart(2, '0')}.txt`,
        content: currentChunkContent,
        size: currentSize
      });

      chunkIndex++;
      currentChunkContent = header.replace("{PART}", chunkIndex.toString()) + fileText;
      currentSize = currentChunkContent.length;
    } else {
      currentChunkContent += fileText;
      currentSize += fileText.length;
    }
  }

  if (currentSize > header.length) {
    chunks.push({
      index: chunkIndex,
      filename: `${projectName}-context-${String(chunkIndex).padStart(2, '0')}.txt`,
      content: currentChunkContent,
      size: currentSize
    });
  }

  return chunks;
};