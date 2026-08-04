import type { RepoFile, CapabilityGroup } from '../types';

interface CapabilitySignature {
  category: string;
  patterns: RegExp[];
  moduleName: string;
}

const CAPABILITY_SIGNATURES: CapabilitySignature[] = [
  {
    category: 'PDF Generation',
    patterns: [/%PDF-1\.\d/, /\bjsPDF\b/i, /function\s+(generatePdf|createPdf|buildPdf)\w*/i],
    moduleName: 'src/shared/services/pdfService.ts'
  },
  {
    category: 'PDF Read/Extract',
    patterns: [/pdfjs-dist/i, /getDocument\(/, /function\s+(extractTextFromPdf|readPdf|parsePdf)\w*/i],
    moduleName: 'src/shared/services/pdfReadService.ts'
  },
  {
    category: 'Image Convert/Compress',
    patterns: [/canvas\.toBlob/, /canvas\.toDataURL/, /function\s+(convertImage|compressImage|resizeImage)\w*/i],
    moduleName: 'src/shared/services/imageService.ts'
  },
  {
    category: 'OCR (Image → Text)',
    patterns: [/paddleocr/i, /tesseract/i, /function\s+(extractTextFromImage|runOcr|ocrImage)\w*/i],
    moduleName: 'src/shared/services/ocrService.ts'
  },
  {
    category: 'File Download/Export',
    patterns: [/createObjectURL\(/, /\.download\s*=/, /function\s+(downloadBlob|triggerDownload|saveAs)\w*/i],
    moduleName: 'src/shared/utils/downloadFile.ts'
  },
  {
    category: 'Audio/Video Processing',
    patterns: [/@ffmpeg\/ffmpeg/i, /createFFmpeg\(/, /function\s+(trimVideo|mergeAudio|extractAudio)\w*/i],
    moduleName: 'src/shared/services/mediaService.ts'
  },
  {
    category: 'QR/Barcode',
    patterns: [/qrcode/i, /jsbarcode/i, /function\s+(generateQr|scanBarcode)\w*/i],
    moduleName: 'src/shared/services/qrBarcodeService.ts'
  },
  {
    category: 'CSV/JSON Parsing',
    patterns: [/papaparse/i, /function\s+(convertJsonToCsv|parseCsv|csvToJson)\w*/i],
    moduleName: 'src/shared/services/tabularDataService.ts'
  }
];

const MIN_APPS = 3;

export function detectCapabilityDuplication(files: RepoFile[]): CapabilityGroup[] {
  const byCategory = new Map<string, Map<string, { filePath: string; matchedSignal: string }>>();

  files.forEach((file) => {
    const appSlug = extractAppSlug(file.path);
    if (!appSlug) return;

    CAPABILITY_SIGNATURES.forEach((sig) => {
      for (const pattern of sig.patterns) {
        const match = file.content.match(pattern);
        if (match) {
          if (!byCategory.has(sig.category)) byCategory.set(sig.category, new Map());
          const appMap = byCategory.get(sig.category)!;
          if (!appMap.has(appSlug)) {
            appMap.set(appSlug, { filePath: file.path, matchedSignal: match[0].slice(0, 60) });
          }
          break;
        }
      }
    });
  });

  const groups: CapabilityGroup[] = [];
  let idx = 0;

  byCategory.forEach((appMap, category) => {
    if (appMap.size >= MIN_APPS) {
      idx++;
      const sig = CAPABILITY_SIGNATURES.find((s) => s.category === category)!;
      groups.push({
        id: `capability-${idx}`,
        category,
        description: `Independently implemented in ${appMap.size} different apps — a good candidate to consolidate into one shared, reusable module.`,
        occurrences: Array.from(appMap.entries()).map(([appSlug, v]) => ({
          appSlug,
          filePath: v.filePath,
          matchedSignal: v.matchedSignal
        })),
        suggestedModuleName: sig.moduleName
      });
    }
  });

  return groups.sort((a, b) => b.occurrences.length - a.occurrences.length);
}

function extractAppSlug(path: string): string | null {
  const match = path.match(/^src\/apps\/([^/]+)\//);
  return match ? match[1] : null;
}
