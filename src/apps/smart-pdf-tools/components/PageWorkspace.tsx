import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { PageItem } from '../types';
import PageThumbnail from './PageThumbnail';

interface PageWorkspaceProps {
  pages: PageItem[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggleSelect: (id: string) => void;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenImageEditor: (id: string) => void;
}

/**
 * The main page grid. Desktop: large scrollable grid on the left of the
 * layout (see SmartPdfToolsPage's CSS grid). Mobile: responsive grid that
 * stacks above the sticky action panel. Handles the "zero pages" empty
 * state so the workspace never silently goes blank.
 */
export default function PageWorkspace({ pages, onReorder, onToggleSelect, onRotate, onDelete, onOpenImageEditor }: PageWorkspaceProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // avoid hijacking simple taps on mobile
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = pages.findIndex((p) => p.id === active.id);
    const toIndex = pages.findIndex((p) => p.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    onReorder(fromIndex, toIndex);
  };

  if (pages.length === 0) {
    return (
      <div className="spt-empty-state" role="status">
        <div className="spt-empty-state__icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 3h7l4 4v14H7z" />
            <path d="M14 3v4h4" />
          </svg>
        </div>
        <p className="spt-empty-state__title">No pages yet</p>
        <p className="spt-empty-state__hint">Add PDFs or images to start building your document.</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="spt-page-grid" role="list" aria-label="Document pages">
          {pages.map((page, index) => (
            <PageThumbnail
              key={page.id}
              page={page}
              index={index}
              onToggleSelect={onToggleSelect}
              onRotate={onRotate}
              onDelete={onDelete}
              onOpenImageEditor={onOpenImageEditor}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
