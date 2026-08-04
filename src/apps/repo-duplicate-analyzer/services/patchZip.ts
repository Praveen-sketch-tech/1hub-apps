import type { GeneratedPatch } from './patchGenerator';

export async function buildPatchZip(patch: GeneratedPatch): Promise<Blob> {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default;
  const zip = new JSZip();

  patch.moduleFiles.forEach((file) => {
    zip.file(file.path, file.content);
  });

  zip.file('apply-refactor.mjs', patch.applyScript);
  zip.file('refactor-manifest.json', patch.manifestJson);
  zip.file('REFACTOR_REPORT.md', patch.reportMarkdown);

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
