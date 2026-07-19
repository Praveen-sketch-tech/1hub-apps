import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PageItem } from '../types';

interface PageThumbnailProps {
  page: PageItem;
  index: number;
  onToggleSelect: (id: string) => void;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenImageEditor?: (id: string) => void;
}

/**
 * One page card in the workspace grid. Wraps @dnd-kit's useSortable for
 * drag-and-drop reordering (mouse + touch, via PointerSensor configured in
 * PageWorkspace) and renders the correct visual state (loading/ready/error).
 */
export default function PageThumbnail({ page, index, onToggleSelect, onRotate, onDelete, onOpenImageEditor }: PageThumbnailProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`spt-page-card ${page.selected ? 'spt-page-card--selected' : ''} ${isDragging ? 'spt-page-card--dragging' : ''}`}
    >
      <div className="spt-page-card__top">
        <label className="spt-page-card__checkbox">
          <input
            type="checkbox"
            checked={page.selected}
            onChange={() => onToggleSelect(page.id)}
            aria-label={`Select page ${index + 1}`}
          />
        </label>
        <button
          type="button"
          className="spt-page-card__drag-handle"
          aria-label={`Drag to reorder page ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="8" cy="6" r="1.5" />
            <circle cx="16" cy="6" r="1.5" />
            <circle cx="8" cy="12" r="1.5" />
            <circle cx="16" cy="12" r="1.5" />
            <circle cx="8" cy="18" r="1.5" />
            <circle cx="16" cy="18" r="1.5" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        className="spt-page-card__preview"
        onClick={() => page.pageType === 'image' && onOpenImageEditor?.(page.id)}
        aria-label={`Page ${index + 1}, ${page.sourceFileName}${page.pageType === 'image' ? ', click to adjust placement' : ''}`}
      >
        {page.thumbnailStatus === 'ready' && page.thumbnailUrl && (
          <img
            src={page.thumbnailUrl}
            alt={`Page ${index + 1} of ${page.sourceFileName}`}
            className="spt-page-card__image"
            style={{ transform: `rotate(${page.rotation}deg)` }}
          />
        )}
        {(page.thumbnailStatus === 'pending' || page.thumbnailStatus === 'rendering') && (
          <div className="spt-page-card__placeholder" role="status">
            <span className="spt-spinner" aria-hidden="true" />
            <span>Rendering…</span>
          </div>
        )}
        {page.thumbnailStatus === 'error' && (
          <div className="spt-page-card__placeholder spt-page-card__placeholder--error" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{page.thumbnailError ?? 'Preview failed'}</span>
          </div>
        )}
      </button>

      <div className="spt-page-card__footer">
        <span className="spt-page-card__number">Page {index + 1}</span>
        <span className="spt-page-card__filename" title={page.sourceFileName}>
          {page.sourceFileName}
        </span>
      </div>

      <div className="spt-page-card__actions">
        <button type="button" className="spt-icon-btn" onClick={() => onRotate(page.id)} aria-label={`Rotate page ${index + 1}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M3 12a9 9 0 1 1 3 6.7" strokeLinecap="round" />
            <path d="M3 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          className="spt-icon-btn spt-icon-btn--danger"
          onClick={() => onDelete(page.id)}
          aria-label={`Delete page ${index + 1}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
