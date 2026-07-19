# App #017 — Universal Test Asset Factory

Route: `/apps/universal-test-asset-factory`

Export: `UniversalTestAssetFactoryPage`

App ID: `universal-test-asset-factory`

Browser-local reusable test/sample asset generator for JPG, PNG, WebP, PDF, CSV, XLSX, TXT, JSON and ZIP workflows.

Core reusable entry point: `lib/assetFactory.ts`

Implemented Hub Assistant actions:
- Generate OCR test image
- Generate scanned multi-page PDF
- Generate sample XLSX workbook
- Generate QR test image
- Generate barcode test image
- Generate sample data file
- Generate mixed test asset bundle

The app uses the locked shared ToolAppHeader and LocalProcessingBadge named imports and keeps core asset generation separate from UI/chat entry points.
