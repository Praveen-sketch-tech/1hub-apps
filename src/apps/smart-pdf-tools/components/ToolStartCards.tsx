import type { ReactNode } from 'react';
import type { ToolMode } from '../types';
import PdfDropzone from './PdfDropzone';
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader';

interface ToolStartCardsProps {
  onFilesSelected: (files: File[], preselectMode: ToolMode) => void;
}

interface CardDef {
  mode: ToolMode;
  title: string;
  description: string;
  icon: ReactNode;
}

const CARDS: CardDef[] = [
  {
    mode: 'images-to-pdf',
    title: 'Create PDF from Images',
    description: 'Turn JPG, PNG, or WebP photos into a polished PDF.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="3" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5-4 4-2-2-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    mode: 'merge',
    title: 'Merge / Edit PDFs',
    description: 'Combine multiple PDFs, reorder, rotate, and clean up pages.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v4h4" />
        <path d="M9 13h6M9 17h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    mode: 'split',
    title: 'Split / Extract Pages',
    description: 'Pull out specific pages or split a PDF into several files.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M6 3v18M6 3l6 4-6 4M18 21V3M18 21l-6-4 6-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    mode: 'compress',
    title: 'Compress PDF',
    description: 'Shrink file size for sharing, with three quality modes.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M8 3v4a1 1 0 0 1-1 1H3M16 3v4a1 1 0 0 0 1 1h4M8 21v-4a1 1 0 0 0-1-1H3M16 21v-4a1 1 0 0 1 1-1h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

/**
 * The initial, pre-upload home state: four clean action cards. Each opens
 * the same unified uploader/workspace with an operation preselected —
 * there are no separate disconnected tool pages.
 */
export default function ToolStartCards({ onFilesSelected }: ToolStartCardsProps) {
  return (
    <div className="spt-home">
      <ToolAppHeader
        appNumber="002"
        title="Smart PDF Tools"
        description="Create, merge, split, reorder, rotate and compress PDFs entirely in your browser."
      />

      <div className="spt-home__cards">
        {CARDS.map((card) => (
          <label key={card.mode ?? 'default'} className="spt-home-card">
            <input
              type="file"
              multiple
              accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              className="spt-visually-hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) onFilesSelected(files, card.mode);
                e.target.value = '';
              }}
            />
            <span className="spt-home-card__icon" aria-hidden="true">
              {card.icon}
            </span>
            <span className="spt-home-card__title">{card.title}</span>
            <span className="spt-home-card__desc">{card.description}</span>
          </label>
        ))}
      </div>

      <div className="spt-home__dropzone">
        <PdfDropzone onFilesSelected={(files) => onFilesSelected(files, null)} />
      </div>
    </div>
  );
}
