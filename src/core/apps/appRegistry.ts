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
  {
    id: 'smart-data-tools',
    number: '005',
    name: "Smart Data Tools",
    description: "Clean, convert, filter and export CSV and JSON data directly in your browser.",
    path: '/apps/smart-data-tools',
    tags: ["CSV","JSON","Data Cleaner","Converter"],
  },
  {
    id: 'smart-calculator-converter',
    number: '006',
    name: "Smart Calculator & Converter",
    description: "Calculate EMI, estimate existing loans, GST, discounts, dates and everyday unit conversions.",
    path: '/apps/smart-calculator-converter',
    tags: ["EMI","GST","Converter","Calculator"],
  },
  {
    id: 'app-007-smart-file-tools',
    number: '007',
    name: "Smart File Tools",
    description: "Rename, inspect, hash, deduplicate, archive, split and merge files locally in your browser.",
    path: '/apps/smart-file-tools',
    tags: ["Bulk Rename","SHA-256","Duplicate Detection","ZIP Tools","File Split","Merge Chunks"],
  },
]