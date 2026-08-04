import type { RepoFile, BundleRisk } from '../types';

const HEAVY_LIBRARIES = [
  { name: '@ffmpeg/ffmpeg', note: 'Large WASM-based video/audio processing library.' },
  { name: '@paddleocr/paddleocr-js', note: 'Large OCR model bundle.' },
  { name: 'tensorflow', note: 'Large machine-learning library.' },
  { name: '@zxing/library', note: 'Barcode/QR scanning library (moderate size).' },
  { name: 'cropperjs', note: 'Image cropping library (moderate size).' }
];

export function checkBundleRisks(files: RepoFile[]): BundleRisk[] {
  const risks: BundleRisk[] = [];

  files.forEach((file) => {
    HEAVY_LIBRARIES.forEach((lib) => {
      if (file.content.includes(lib.name)) {
        const isSharedOrCore = file.path.startsWith('src/shared/') || file.path.startsWith('src/core/');
        risks.push({
          library: lib.name,
          filePath: file.path,
          note: isSharedOrCore
            ? `${lib.note} Imported from a shared/core file — this can pull it into the bundle for every page instead of just one app. Consider lazy-loading it only where needed.`
            : lib.note
        });
      }
    });
  });

  return risks;
}
