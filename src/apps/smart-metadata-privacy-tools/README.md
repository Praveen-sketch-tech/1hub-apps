# App #013 — Smart Metadata & Privacy Tools

Inspect and remove privacy-sensitive metadata from files directly in your browser.
Nothing is ever uploaded — all parsing and cleaning happens locally using the File,
Canvas, and DataView browser APIs.

## What's included

```
smart-metadata-privacy-tools/
  SmartMetadataPrivacyToolsPage.tsx   Main page component
  index.ts                            export { SmartMetadataPrivacyToolsPage }
  chatActions.ts                      Chat module (inspect / remove metadata)
  smart-metadata-privacy-tools.css    Scoped, theme-aware styles
  components/
    FileDropZone.tsx                  Drag & drop / file picker
    MetadataTable.tsx                 Renders detected metadata groups
    PrivacyRiskPanel.tsx              Risk banner + flagged fields
    CleanActionPanel.tsx              "Remove Metadata" + download
    ReportActions.tsx                 Copy / download TXT / JSON report
  lib/
    types.ts                          Shared TypeScript types
    fileInfo.ts                       File type detection, byte/date formatting
    exifParser.ts                     Dependency-free EXIF/TIFF parser
    imageMetadata.ts                  JPEG/WebP EXIF + PNG text-chunk inspection
    imageCleaner.ts                   Canvas re-encode privacy cleaner
    pdfMetadata.ts                    pdf-lib based PDF inspect/clean
    mediaMetadata.ts                  Audio/video basic technical info
    privacyAnalysis.ts                Risk scoring (low/medium/high)
    report.ts                         TXT/JSON report generation
    metadata.ts                       Orchestrator used by BOTH the UI and chat
    download.ts                       Local download helper (see note below)
  README.md
```

## How it works, by file type

| Type | Inspect | Clean |
|---|---|---|
| JPEG | Full EXIF (camera, date, GPS, software, artist, technical) | Canvas re-encode → JPG/PNG/WebP |
| PNG | tEXt/iTXt text chunks + tIME | Canvas re-encode → JPG/PNG/WebP |
| WebP | EXIF chunk (same TIFF parser as JPEG) | Canvas re-encode → JPG/PNG/WebP |
| Other images | Basic file info only | Canvas re-encode (best effort) |
| PDF | Standard document-info fields (title, author, subject, keywords, creator, producer, dates) via `pdf-lib` | Clears those fields, preserves page content, via `pdf-lib` |
| Audio | Duration only (no public browser API exposes ID3/tag data) | Not supported — clearly stated in UI and chat |
| Video | Duration + dimensions | Not supported — clearly stated in UI and chat |
| Other | Name/type/size/date only | Not supported |

**Honesty guarantee:** `lib/metadata.ts` is the single source of truth for what
is "supported" for cleaning (`CleaningSupport`). Both the UI's Remove Metadata
button and the chat's "remove metadata" action call `cleanFile()` from that
same file — if it throws, the user is told cleaning isn't available rather
than being shown a fake success.

**Image cleaning caveat:** the app decodes the image fully via
`createImageBitmap` and re-encodes it via `<canvas>.toBlob()`. Browsers do not
write EXIF/XMP back out when exporting canvas content, so this reliably strips
metadata. It is **not** guaranteed to be byte-identical to the original —
JPEG/WebP output is recompressed (default quality ~92%), PNG output is
lossless. This is stated to the user after cleaning.

**PDF cleaning caveat:** only the standard PDF *document info dictionary* is
cleared. This does not rewrite/guarantee removal of custom XMP metadata
streams or other embedded objects some producers add. This is stated to the
user after cleaning and in the inspection warnings.

## Dependencies

**No new dependency is required.** EXIF/TIFF parsing is implemented manually
in `lib/exifParser.ts` (reads the JPEG APP1 "Exif" segment / WebP "EXIF" RIFF
chunk and walks the TIFF IFD structure) specifically to avoid adding a new
package. PDF inspection/cleaning uses your existing `pdf-lib` dependency —
no import from `pdfjs-dist` was needed for this app.

If you'd prefer a more complete EXIF library later (e.g. `exifr`), that's an
optional upgrade, not a requirement — the current parser covers all fields
listed in the spec (camera make/model, date/time, orientation, GPS lat/lon,
software, artist, copyright, dimensions, plus common technical fields).

## Integration notes / things to double check

1. **`ToolAppHeader` / `LocalProcessingBadge` props.** The page imports these
   from `@/shared/components/tools/ToolAppHeader` and
   `@/shared/components/tools/LocalProcessingBadge` and passes
   `title`/`description` to the header. If your actual prop names differ,
   adjust the two JSX call sites at the top of `SmartMetadataPrivacyToolsPage.tsx`
   — nothing else depends on them.
2. **`@/` path alias.** The header/badge imports assume a `@/` → `src/`
   alias (common in Vite setups). If your project uses a different alias or
   relative imports, update those two import lines.
3. **`lib/download.ts`.** A small local `downloadBlob`/`downloadText` helper
   is included because the exact exported signature of
   `src/shared/utils/downloads.ts` wasn't available. If that shared utility
   exposes a compatible function, you can delete `lib/download.ts` and swap
   the three importing files (`CleanActionPanel.tsx`, `ReportActions.tsx`) to
   import from the shared util instead. Everything else is unaffected.
4. **`chatActions.ts` / `AppChatModule` shape.** The file is written against
   the documented shape (`appId`, `actions[]` with `label`/`description` for
   the dynamic help system, plus `keywords`/`requiresFile`/`handler`). If
   your real `@core/chat/types` interface names these fields differently,
   only the small `chatModule` object at the bottom needs adjusting — the
   actual logic (`runInspect`/`runRemove`, which call `inspectFile()` /
   `cleanFile()` from `lib/metadata.ts`) does not need to change.
5. **Upload component.** A self-contained `FileDropZone.tsx` is included
   rather than guessing the exact export from
   `src/shared/components/upload/`. Swap it for your shared uploader if you'd
   like — it only needs to call `onFileSelected(file: File)`.

## Manual test checklist

See the testing guide provided alongside the install command in chat.
