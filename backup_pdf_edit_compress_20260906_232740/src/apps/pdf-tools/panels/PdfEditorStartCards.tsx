import type { ToolMode } from '@apps/smart-pdf-tools/types'
import PdfDropzone from '@apps/smart-pdf-tools/components/PdfDropzone'

interface StartCardsProps {
  onFilesSelected: (files: File[], preselectMode: ToolMode) => void
}

const CARDS: { mode: ToolMode; title: string; description: string }[] = [
  { mode: 'images-to-pdf', title: 'Create PDF from Images', description: 'Turn JPG, PNG, or WebP photos into a polished PDF.' },
  { mode: 'merge', title: 'Merge / Edit PDFs', description: 'Combine multiple PDFs, reorder, rotate, and clean up pages.' },
  { mode: 'split', title: 'Split PDF', description: 'Split a PDF into several files by page range.' },
  { mode: 'extract', title: 'Extract Pages', description: 'Pull out specific pages into a new PDF.' },
]

export function PdfEditorStartCards({ onFilesSelected }: StartCardsProps) {
  return (
    <div className="pdft-editor-start">
      <div className="pdft-editor-cards">
        {CARDS.map((card) => (
          <div key={card.mode} className="pdft-editor-card">
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <PdfDropzone
              label="PDF/images upload karo"
              onFilesSelected={(files) => onFilesSelected(files, card.mode)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
