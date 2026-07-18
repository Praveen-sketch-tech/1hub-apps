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
]