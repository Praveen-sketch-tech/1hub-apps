import JSZip from 'jszip';
import { ExtractedFile, ExtractionStats, AppConfig } from '../types';

export const processZipFile = async (
  file: File,
  config: AppConfig
): Promise<{ files: ExtractedFile[]; stats: ExtractionStats }> => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const extractedFiles: ExtractedFile[] = [];
  const stats: ExtractionStats = {
    totalFiles: 0,
    codeFiles: 0,
    totalLines: 0,
    totalSize: 0,
  };

  const filePaths = Object.keys(loadedZip.files);
  stats.totalFiles = filePaths.length;

  for (const relativePath of filePaths) {
    const zipEntry = loadedZip.files[relativePath];
    if (zipEntry.dir) continue;

    const shouldExclude = config.excludePatterns.some(pattern =>
      relativePath.includes(pattern) || relativePath.endsWith(pattern)
    );
    if (shouldExclude) continue;

    const extension = '.' + relativePath.split('.').pop()?.toLowerCase();
    const isIncluded = config.includeExtensions.includes(extension) || config.includeExtensions.includes('*');
    if (!isIncluded) continue;

    try {
      const content = await zipEntry.async('text');
      const size = content.length;
      const lines = content.split('\n').length;

      extractedFiles.push({
        id: Math.random().toString(36).substring(2, 9),
        path: relativePath,
        content,
        size,
        lines,
        extension,
      });

      stats.codeFiles++;
      stats.totalLines += lines;
      stats.totalSize += size;
    } catch (error) {
      console.warn(`Could not read file: ${relativePath}`, error);
    }
  }

  extractedFiles.sort((a, b) => a.path.localeCompare(b.path));
  return { files: extractedFiles, stats };
};