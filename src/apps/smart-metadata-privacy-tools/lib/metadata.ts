import { getBasicFileInfo } from './fileInfo';
import { inspectImageMetadata } from './imageMetadata';
import { inspectPdfMetadata, cleanPdfMetadata } from './pdfMetadata';
import { inspectMediaMetadata } from './mediaMetadata';
import { analyzePrivacyRisk } from './privacyAnalysis';
import { cleanImageMetadata, suggestOutputFormat } from './imageCleaner';
import type { BasicFileInfo, CleaningSupport, CleanResult, InspectionResult, ImageOutputFormat } from './types';

/**
 * Central entry point: inspects any supported file and returns a normalized
 * result. Both the UI page and chatActions.ts call this so behaviour never
 * diverges between the two surfaces.
 */
export async function inspectFile(file: File): Promise<InspectionResult> {
  const fileInfo: BasicFileInfo = getBasicFileInfo(file);
  const warnings: string[] = [];
  let groups: InspectionResult['groups'] = [];
  let cleaning: CleaningSupport = { supported: false, reason: 'Metadata cleaning is not available for this file type.' };

  switch (fileInfo.category) {
    case 'image-jpeg':
    case 'image-png':
    case 'image-webp': {
      const result = await inspectImageMetadata(file);
      groups = result.groups;
      warnings.push(...result.warnings);
      cleaning = { supported: true };
      break;
    }
    case 'image-other': {
      warnings.push('This image format is not fully supported for EXIF inspection, but a privacy-cleaned copy can still be produced by re-encoding it.');
      cleaning = { supported: true };
      break;
    }
    case 'pdf': {
      const result = await inspectPdfMetadata(file);
      groups = result.groups;
      warnings.push(...result.warnings);
      cleaning = { supported: true };
      break;
    }
    case 'audio': {
      const result = await inspectMediaMetadata(file, 'audio');
      groups = result.groups;
      warnings.push(...result.warnings);
      cleaning = { supported: false, reason: 'Automatic metadata cleaning for audio files is not supported by any current browser API.' };
      break;
    }
    case 'video': {
      const result = await inspectMediaMetadata(file, 'video');
      groups = result.groups;
      warnings.push(...result.warnings);
      cleaning = { supported: false, reason: 'Automatic metadata cleaning for video files is not supported by any current browser API.' };
      break;
    }
    default: {
      warnings.push('This file type is not specifically supported. Only basic file information is shown.');
      cleaning = { supported: false, reason: 'Metadata cleaning is only available for images and PDFs.' };
    }
  }

  const privacy = analyzePrivacyRisk(groups);

  return { file: fileInfo, groups, privacy, cleaning, warnings };
}

/**
 * Central cleaning entry point: produces a privacy-cleaned copy of the file
 * when supported, or throws a clear, honest error when it is not. Both the
 * UI and chatActions.ts call this so cleaning behaviour never diverges.
 */
export async function cleanFile(
  file: File,
  options?: { imageOutputFormat?: ImageOutputFormat; imageQuality?: number },
): Promise<CleanResult> {
  const fileInfo = getBasicFileInfo(file);

  switch (fileInfo.category) {
    case 'image-jpeg':
    case 'image-png':
    case 'image-webp':
    case 'image-other': {
      const format = options?.imageOutputFormat ?? suggestOutputFormat(file);
      return cleanImageMetadata(file, format, options?.imageQuality);
    }
    case 'pdf':
      return cleanPdfMetadata(file);
    default:
      throw new Error(
        `Automatic metadata cleaning is not supported for ${fileInfo.type || 'this file type'}. ` +
          'Only images (JPG/PNG/WebP) and PDFs can currently be cleaned in the browser.',
      );
  }
}
