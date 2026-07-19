import type { ReactNode } from 'react';
import type { ToolMode } from '../types';
import PdfDropzone from './PdfDropzone';

interface WorkspaceToolbarProps {
  toolMode: ToolMode;
  onChangeMode: (mode: ToolMode) => void;
  pageCount: number;
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onRotateSelected: () => void;
  onDeleteSelected: () => void;
  onExtractSelected: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onAddFiles: (files: File[]) => void;
  onStartOver: () => void;
  children?: ReactNode;
}

const MODE_TABS: { mode: ToolMode; label: string }[] = [
  { mode: 'merge', label: 'Merge / Edit' },
  { mode: 'images-to-pdf', label: 'Images → PDF' },
  { mode: 'split', label: 'Split' },
  { mode: 'extract', label: 'Extract' },
  { mode: 'compress', label: 'Compress' },
];

/**
 * The tool/action control panel. Desktop: fixed column on the right.
 * Mobile: rendered below the page grid as a sticky action panel (layout is
 * handled by CSS in smart-pdf-tools.css, this component's markup is shared).
 */
export default function WorkspaceToolbar({
  toolMode,
  onChangeMode,
  pageCount,
  selectedCount,
  onSelectAll,
  onClearSelection,
  onRotateSelected,
  onDeleteSelected,
  onExtractSelected,
  onUndo,
  canUndo,
  onAddFiles,
  onStartOver,
  children,
}: WorkspaceToolbarProps) {
  return (
    <aside className="spt-toolbar" aria-label="Page tools">
      <div className="spt-toolbar__section">
        <h2 className="spt-toolbar__heading">Output</h2>
        <div className="spt-mode-tabs" role="tablist">
          {MODE_TABS.map((tab) => (
            <button
              key={tab.mode}
              role="tab"
              type="button"
              aria-selected={toolMode === tab.mode}
              className={`spt-mode-tab ${toolMode === tab.mode ? 'spt-mode-tab--active' : ''}`}
              onClick={() => onChangeMode(tab.mode)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="spt-toolbar__section">
        <h2 className="spt-toolbar__heading">
          Pages <span className="spt-toolbar__count">({pageCount})</span>
        </h2>
        <div className="spt-toolbar__row">
          <button type="button" className="spt-btn spt-btn--ghost" onClick={onSelectAll} disabled={pageCount === 0}>
            Select all
          </button>
          <button type="button" className="spt-btn spt-btn--ghost" onClick={onClearSelection} disabled={selectedCount === 0}>
            Clear selection
          </button>
        </div>
        <div className="spt-toolbar__row">
          <button type="button" className="spt-btn spt-btn--ghost" onClick={onRotateSelected} disabled={selectedCount === 0}>
            Rotate selected
          </button>
          <button
            type="button"
            className="spt-btn spt-btn--ghost spt-btn--danger"
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
          >
            Delete selected
          </button>
        </div>
        {toolMode === 'extract' && (
          <button
            type="button"
            className="spt-btn spt-btn--primary spt-toolbar__extract"
            onClick={onExtractSelected}
            disabled={selectedCount === 0}
          >
            Extract selected ({selectedCount})
          </button>
        )}
        <button type="button" className="spt-btn spt-btn--ghost spt-toolbar__undo" onClick={onUndo} disabled={!canUndo}>
          ↺ Undo last action
        </button>
      </div>

      {children && <div className="spt-toolbar__section">{children}</div>}

      <div className="spt-toolbar__section">
        <h2 className="spt-toolbar__heading">Add files</h2>
        <PdfDropzone onFilesSelected={onAddFiles} compact label="Add more PDFs or images" />
      </div>

      <div className="spt-toolbar__section">
        <button type="button" className="spt-btn spt-btn--text" onClick={onStartOver}>
          Start over
        </button>
      </div>
    </aside>
  );
}
