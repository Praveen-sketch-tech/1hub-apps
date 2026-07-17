import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ImagePlacement, Margin, Orientation, PageSize, PageItem, ImageFit } from '../types';
import { computePlacedImageRect, resolvePageDimensions } from '../lib/imageToPdf';

interface ImagePageEditorProps {
  page: PageItem;
  imageUrl: string;
  imageDimensions: { width: number; height: number };
  onChange: (updater: (prev: ImagePlacement | undefined) => ImagePlacement | undefined) => void;
  onClose: () => void;
}

const PREVIEW_MAX = 380; // px, the on-screen preview box's longer side

/**
 * Modal editor for a single image-derived page: drag the image inside the
 * page, resize with a corner handle, adjust page size/orientation/margins/
 * fit. This intentionally stays a single-image, single-page editor (no
 * layers) per the v1 scope.
 */
export default function ImagePageEditor({ page, imageUrl, imageDimensions, onChange, onClose }: ImagePageEditorProps) {
  const placement = page.imagePlacement;
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);
  const resizeState = useRef<{ startY: number; startScale: number } | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: PREVIEW_MAX, height: PREVIEW_MAX });

  const pageDims = useMemo(() => {
    if (!placement) return { width: PREVIEW_MAX, height: PREVIEW_MAX };
    return resolvePageDimensions(placement.pageSize, placement.orientation, imageDimensions.width, imageDimensions.height);
  }, [placement, imageDimensions]);

  useEffect(() => {
    const aspect = pageDims.width / pageDims.height;
    if (aspect >= 1) {
      setPreviewSize({ width: PREVIEW_MAX, height: PREVIEW_MAX / aspect });
    } else {
      setPreviewSize({ width: PREVIEW_MAX * aspect, height: PREVIEW_MAX });
    }
  }, [pageDims]);

  if (!placement) return null;

  const scaleFactor = previewSize.width / pageDims.width;
  const rect = computePlacedImageRect(placement, pageDims, imageDimensions.width, imageDimensions.height);
  const previewRect = {
    x: rect.x * scaleFactor,
    y: rect.y * scaleFactor,
    width: rect.width * scaleFactor,
    height: rect.height * scaleFactor,
  };

  const update = (partial: Partial<ImagePlacement>) => {
    onChange((prev) => ({ ...(prev ?? placement), ...partial }));
  };

  const handleDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, startOffsetX: placement.offsetX, startOffsetY: placement.offsetY };
  };

  const handleDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const normX = dx / previewSize.width;
    const normY = dy / previewSize.height;
    update({
      offsetX: clamp01(dragState.current.startOffsetX + normX),
      offsetY: clamp01(dragState.current.startOffsetY + normY),
    });
  };

  const handleDragEnd = () => {
    dragState.current = null;
  };

  const handleResizeStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeState.current = { startY: e.clientY, startScale: placement.scale };
  };

  const handleResizeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeState.current) return;
    const dy = e.clientY - resizeState.current.startY;
    const nextScale = clamp(resizeState.current.startScale + dy / 150, 0.2, 3);
    update({ scale: nextScale });
  };

  const handleResizeEnd = () => {
    resizeState.current = null;
  };

  return (
    <div className="spt-modal-overlay" role="dialog" aria-modal="true" aria-label="Adjust image placement">
      <div className="spt-modal spt-image-editor">
        <div className="spt-modal__header">
          <h2>Adjust image placement</h2>
          <button type="button" className="spt-icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="spt-image-editor__body">
          <div
            ref={containerRef}
            className="spt-image-editor__page"
            style={{ width: previewSize.width, height: previewSize.height }}
          >
            <div
              className="spt-image-editor__image-wrap"
              style={{ left: previewRect.x, top: previewRect.y, width: previewRect.width, height: previewRect.height }}
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
            >
              <img src={imageUrl} alt="" draggable={false} className="spt-image-editor__image" />
              <div
                className="spt-image-editor__handle"
                onPointerDown={handleResizeStart}
                onPointerMove={handleResizeMove}
                onPointerUp={handleResizeEnd}
                onPointerCancel={handleResizeEnd}
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="spt-image-editor__controls">
            <FieldSelect
              label="Page size"
              value={placement.pageSize}
              onChange={(v) => update({ pageSize: v as PageSize })}
              options={[
                { value: 'a4', label: 'A4' },
                { value: 'letter', label: 'Letter' },
                { value: 'fit', label: 'Fit to image' },
              ]}
            />
            <FieldSelect
              label="Orientation"
              value={placement.orientation}
              onChange={(v) => update({ orientation: v as Orientation })}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'portrait', label: 'Portrait' },
                { value: 'landscape', label: 'Landscape' },
              ]}
              disabled={placement.pageSize === 'fit'}
            />
            <FieldSelect
              label="Margins"
              value={placement.margin}
              onChange={(v) => update({ margin: v as Margin })}
              options={[
                { value: 'none', label: 'None' },
                { value: 'small', label: 'Small' },
                { value: 'normal', label: 'Normal' },
              ]}
            />
            <FieldSelect
              label="Image fit"
              value={placement.fit}
              onChange={(v) => update({ fit: v as ImageFit })}
              options={[
                { value: 'fit', label: 'Fit' },
                { value: 'fill', label: 'Fill' },
                { value: 'center', label: 'Center' },
              ]}
            />

            <label className="spt-field-label" htmlFor="spt-scale-slider">
              Zoom
            </label>
            <input
              id="spt-scale-slider"
              type="range"
              min={0.2}
              max={3}
              step={0.05}
              value={placement.scale}
              onChange={(e) => update({ scale: parseFloat(e.target.value) })}
            />

            <div className="spt-toolbar__row">
              <button type="button" className="spt-btn spt-btn--ghost" onClick={() => update({ offsetX: 0.5, offsetY: 0.5 })}>
                Center
              </button>
              <button
                type="button"
                className="spt-btn spt-btn--ghost"
                onClick={() => update({ offsetX: 0.5, offsetY: 0.5, scale: 1 })}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="spt-modal__footer">
          <button type="button" className="spt-btn spt-btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

interface FieldSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}

function FieldSelect({ label, value, onChange, options, disabled }: FieldSelectProps) {
  const id = `spt-field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="spt-field">
      <label className="spt-field-label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="spt-select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
