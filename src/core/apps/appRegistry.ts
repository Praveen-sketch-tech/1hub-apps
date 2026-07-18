export interface AppDefinition {
  id: string
  number: string
  name: string
  description: string
  path: string
  tags: string[]
}

export const APP_REGISTRY: AppDefinition[] = [
  {
    id: 'smart-image-tools',
    number: '001',
    name: 'Smart Image Tools',
    description: 'Compress, resize, convert and crop images directly in your browser.',
    path: '/apps/smart-image-tools',
    tags: ['Compress', 'Resize', 'Convert', 'Crop'],
  },
  {
    id: 'smart-pdf-tools',
    number: '002',
    name: 'Smart PDF Tools',
    description: 'Create, merge, split, reorder, rotate and compress PDFs directly in your browser.',
    path: '/apps/smart-pdf-tools',
    tags: ['Merge', 'Split', 'Compress', 'Images to PDF'],
  },
  {
    id: 'qr-barcode-studio',
    number: '003',
    name: 'QR & Barcode Studio',
    description: 'Create and scan QR codes and barcodes privately in your browser.',
    path: '/apps/qr-barcode-studio',
    tags: ['QR Generator', 'Barcode', 'Scanner', 'Wi-Fi QR'],
  },
  {
    id: 'smart-text-tools',
    number: '004',
    name: 'Smart Text Tools',
    description: 'Clean, convert, compare and extract useful data from text instantly.',
    path: '/apps/smart-text-tools',
    tags: ['Text Cleaner', 'Case Converter', 'Compare', 'JSON'],
  },
]
