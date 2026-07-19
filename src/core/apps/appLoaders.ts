import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export interface AppLoaderDefinition {
  path: string
  name: string
  component: LazyExoticComponent<ComponentType>
}

export const APP_LOADERS: AppLoaderDefinition[] = [
  {
    path: '/apps/smart-image-tools',
    name: 'Smart Image Tools',
    component: lazy(() =>
      import('@apps/smart-image-tools').then((module) => ({
        default: module.SmartImageToolsPage,
      }))
    ),
  },
  {
    path: '/apps/smart-pdf-tools',
    name: 'Smart PDF Tools',
    component: lazy(() =>
      import('@apps/smart-pdf-tools').then((module) => ({
        default: module.SmartPdfToolsPage,
      }))
    ),
  },
  {
    path: '/apps/qr-barcode-studio',
    name: 'QR & Barcode Studio',
    component: lazy(() =>
      import('@apps/qr-barcode-studio').then((module) => ({
        default: module.QrBarcodeStudioPage,
      }))
    ),
  },
  {
    path: '/apps/smart-text-tools',
    name: 'Smart Text Tools',
    component: lazy(() =>
      import('@apps/smart-text-tools').then((module) => ({
        default: module.SmartTextToolsPage,
      }))
    ),
  },
  {
    path: '/apps/smart-data-tools',
    name: "Smart Data Tools",
    component: lazy(() =>
      import('@apps/smart-data-tools').then((module) => ({
        default: module.SmartDataToolsPage,
      }))
    ),
  },
  {
    path: '/apps/smart-calculator-converter',
    name: "Smart Calculator & Converter",
    component: lazy(() =>
      import('@apps/smart-calculator-converter').then((module) => ({
        default: module.SmartCalculatorConverterPage,
      }))
    ),
  },
  {
    path: '/apps/smart-file-tools',
    name: "Smart File Tools",
    component: lazy(() =>
      import('@apps/smart-file-tools').then((module) => ({
        default: module.SmartFileToolsPage,
      }))
    ),
  },
  {
    path: '/apps/smart-document-scanner-ocr',
    name: "Smart Document Scanner & OCR",
    component: lazy(() =>
      import('@apps/smart-document-scanner-ocr').then((module) => ({
        default: module.SmartDocumentScannerOcrPage,
      }))
    ),
  },
  {
    path: '/apps/smart-audio-tools',
    name: "Smart Audio Tools",
    component: lazy(() =>
      import('@apps/smart-audio-tools').then((module) => ({
        default: module.SmartAudioToolsPage,
      }))
    ),
  },
  {
    path: '/apps/smart-video-tools',
    name: "Smart Video Tools",
    component: lazy(() =>
      import('@apps/smart-video-tools').then((module) => ({
        default: module.SmartVideoToolsPage,
      }))
    ),
  },
  {
    path: '/apps/smart-password-generator',
    name: "Smart Password Generator",
    component: lazy(() =>
      import('@apps/smart-password-generator').then((module) => ({
        default: module.SmartPasswordGeneratorPage,
      }))
    ),
  },
  {
    path: '/apps/smart-uuid-generator',
    name: "Smart UUID Generator",
    component: lazy(() =>
      import('@apps/smart-uuid-generator').then((module) => ({
        default: module.SmartUuidGeneratorPage,
      }))
    ),
  },
  {
    path: '/apps/smart-metadata-privacy-tools',
    name: "Smart Metadata & Privacy Tools",
    component: lazy(() =>
      import('@apps/smart-metadata-privacy-tools').then((module) => ({
        default: module.SmartMetadataPrivacyToolsPage,
      }))
    ),
  },
  {
    path: '/apps/smart-archive-tools',
    name: "Smart Archive Tools",
    component: lazy(() =>
      import('@apps/smart-archive-tools').then((module) => ({
        default: module.SmartArchiveToolsPage,
      }))
    ),
  },
]