import type { AppChatModule } from '@core/chat/types';
import { inspectFile, cleanFile } from './lib/metadata';
import { buildTextReport } from './lib/report';

// ============================================================================
// Chat integration for Smart Metadata & Privacy Tools.
//
// IMPORTANT: these actions do NOT re-implement any parsing/cleaning logic.
// They call the exact same lib/metadata.ts functions (`inspectFile`,
// `cleanFile`) used by SmartMetadataPrivacyToolsPage.tsx, so the UI and chat
// can never disagree about what was detected or removed.
//
// NOTE ON TYPES: this file is written against the documented shape of
// `AppChatModule` (appId + actions[], each with label/description used by
// the dynamic help system). If your exact `@core/chat/types` interface uses
// slightly different field names for the match/keywords or the handler
// signature, adjust the two small "run" functions below accordingly — the
// underlying calls to inspectFile()/cleanFile() do not need to change.
// ============================================================================

const INSPECT_KEYWORDS = [
  'inspect metadata',
  'check metadata',
  'show metadata',
  'check this file for metadata',
  'view metadata',
  'read metadata',
  'metadata check',
  'photo ki metadata check karo',
  'metadata dikhao',
];

const REMOVE_KEYWORDS = [
  'remove metadata',
  'clean metadata',
  'remove exif',
  'strip metadata',
  'privacy clean this image',
  'privacy clean',
  'metadata hatao',
  'exif hatao',
];

async function runInspect(file: File): Promise<{ text: string }> {
  const result = await inspectFile(file);
  const report = buildTextReport(result);
  const flagCount = result.privacy.flags.length;
  const headline =
    flagCount > 0
      ? `Found ${flagCount} privacy-sensitive field${flagCount === 1 ? '' : 's'} in "${file.name}" (overall risk: ${result.privacy.overall.toUpperCase()}).`
      : `No privacy-sensitive metadata was flagged in "${file.name}".`;

  return { text: `${headline}\n\n${report}` };
}

async function runRemove(file: File): Promise<{ text: string; blob?: Blob; fileName?: string }> {
  try {
    const cleaned = await cleanFile(file);
    return {
      text: `Created a metadata-cleaned copy of "${file.name}". ${cleaned.note}`,
      blob: cleaned.blob,
      fileName: cleaned.fileName,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Automatic cleaning is not supported for this file type.';
    return {
      text: `I can inspect "${file.name}", but I can't automatically clean it: ${reason}`,
    };
  }
}

export const chatModule: AppChatModule = {
  appId: 'smart-metadata-privacy-tools',
  actions: [
    {
      id: 'inspect-metadata',
      appId: 'smart-metadata-privacy-tools',
      label: 'Inspect metadata',
      description:
        'Inspects an attached image, PDF, audio, or video file and reports any detected metadata (EXIF, GPS, document info, etc.) along with a privacy risk summary.',
      keywords: INSPECT_KEYWORDS,
      requiresFile: true,
      canHandle: ({ input, file }) =>
        Boolean(
          file &&
          /inspect metadata|check metadata|show metadata|file.*metadata|photo.*metadata/i.test(input),
        ),
      execute: async ({ file }: { file?: File }) => {
        if (!file) {
          return { text: 'Please attach a file so I can inspect its metadata.' };
        }
        return runInspect(file);
      },
    },
    {
      id: 'remove-metadata',
      appId: 'smart-metadata-privacy-tools',
      label: 'Remove metadata',
      description:
        'Creates a privacy-cleaned copy of an attached image (JPG/PNG/WebP) or PDF with metadata removed, and returns it as a downloadable file. For file types that cannot be safely cleaned in the browser (audio, video, etc.), it explains that only inspection is supported.',
      keywords: REMOVE_KEYWORDS,
      requiresFile: true,
      canHandle: ({ input, file }) =>
        Boolean(
          file &&
          /remove metadata|clean metadata|remove exif|privacy clean|metadata hata/i.test(input),
        ),
      execute: async ({ file }: { file?: File }) => {
        if (!file) {
          return { text: 'Please attach a supported file (image or PDF) so I can remove its metadata.' };
        }
        return runRemove(file);
      },
    },
  ],
};

export default chatModule;
