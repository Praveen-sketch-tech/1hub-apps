import type { GeneratedFile } from './fillEngine';

export async function buildOutputZip(files: GeneratedFile[]): Promise<Blob> {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const zip = new JSZip();

  files.forEach((f) => {
    zip.file(f.fileName, f.blob);
  });

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
