# App #008 — Smart Document Scanner & OCR

Installer-oriented app package for 1 Hub Apps.

## Route
`/apps/smart-document-scanner-ocr`

## Entry
`index.ts` default-exports `SmartDocumentScannerOcrPage`.

## Runtime dependencies
- `tesseract.js` — dynamically imported only when OCR starts
- `pdfjs-dist` — dynamically imported only for PDF input
- `pdf-lib` — dynamically imported only for PDF export

The host app should keep the app itself behind the existing `APP_LOADERS` lazy-loader. No service worker or PWA code is included.

## Local-processing behavior
Document pixels and OCR recognition remain in the browser. Tesseract language data can be downloaded/cached on first OCR use depending on host Tesseract configuration; documents are not uploaded by this app.

## Features included
- Multi-image + PDF input
- Multi-page workspace
- Best-effort automatic document edge detection
- Four-corner manual crop
- Perspective-style correction approximation
- Automatic deskew estimation
- Rotate, reorder, delete
- Auto, color, grayscale, B&W and high-contrast modes
- Brightness, contrast and sharpen controls
- Lazy Tesseract OCR: English, Hindi, English + Hindi
- OCR current/all pages, progress, cancel, edit, copy, search
- TXT, cleaned JPG/PNG, PDF and best-effort searchable PDF export
- Shared `local-processing-badge` markup
- Mobile-first responsive UI

## Notes
- Edge detection and deskew use lightweight browser-local heuristics with safe fallbacks. True OpenCV-grade contour detection/projective homography can be added later, but this package deliberately avoids bundling OpenCV/WASM to keep startup lighter.
- Searchable PDF uses the scanned page image plus an invisible OCR text layer. English ASCII text is embedded directly; complex Hindi text positioning/font embedding may require a bundled Devanagari font in a later enhancement.
