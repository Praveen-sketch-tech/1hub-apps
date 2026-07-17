/**
 * Core types for Smart PDF Tools.
 *
 * A PageItem is the normalized internal representation of a single page,
 * regardless of whether it originated from an uploaded PDF or an uploaded
 * image. The entire workspace (thumbnails, reorder, rotate, delete, output
 * generation) operates on arrays of PageItem so all tools share one model.
 */

export type PageSourceType = 'pdf' | 'image';

export type PageSize = 'a4' | 'letter' | 'fit';
export type Orientation = 'auto' | 'portrait' | 'landscape';
export type Margin = 'none' | 'small' | 'normal';
export type ImageFit = 'fit' | 'fill' | 'center';

/**
 * Placement of an image within an auto-generated PDF page.
 * All values are normalized (0..1) relative to the page content area so
 * they remain valid regardless of final page pixel/point size.
 */
export interface ImagePlacement {
  pageSize: PageSize;
  orientation: Orientation;
  margin: Margin;
  fit: ImageFit;
  /** 0..1, position of image top-left within the placeable area */
  offsetX: number;
  offsetY: number;
  /** scale multiplier applied on top of the base "fit" calculation */
  scale: number;
}

export function createDefaultImagePlacement(): ImagePlacement {
  return {
    pageSize: 'a4',
    orientation: 'auto',
    margin: 'normal',
    fit: 'fit',
    offsetX: 0.5,
    offsetY: 0.5,
    scale: 1,
  };
}

/**
 * A single reference to the bytes backing a page. For PDF-derived pages,
 * many pages can point at the same shared ArrayBuffer (the original file)
 * to avoid duplicating large buffers in memory.
 */
export interface SourceFileRef {
  id: string;
  fileName: string;
  fileType: PageSourceType;
  /** Original file size in bytes, for display purposes only. */
  fileSize: number;
  /** Raw bytes of the original uploaded file (PDF or image). */
  bytes: ArrayBuffer;
}

export type ThumbnailStatus = 'pending' | 'rendering' | 'ready' | 'error';

export interface PageItem {
  id: string;
  /** id of the SourceFileRef this page's content is derived from */
  sourceId: string;
  sourceFileName: string;
  pageType: PageSourceType;
  /** page index (0-based) within the original PDF; undefined for images */
  originalPageIndex?: number;
  thumbnailUrl?: string;
  thumbnailStatus: ThumbnailStatus;
  thumbnailError?: string;
  rotation: 0 | 90 | 180 | 270;
  selected: boolean;
  /** position in the workspace, kept in sync with array order */
  order: number;
  /** only present for pageType === 'image' */
  imagePlacement?: ImagePlacement;
}

export type ActionKind =
  | 'reorder'
  | 'rotate-one'
  | 'rotate-selected'
  | 'delete-one'
  | 'delete-selected'
  | 'add-files';

export interface WorkspaceSnapshot {
  kind: ActionKind;
  pages: PageItem[];
  timestamp: number;
}

export type ToolMode =
  | 'images-to-pdf'
  | 'merge'
  | 'split'
  | 'extract'
  | 'compress'
  | null;

export type CompressionMode = 'light' | 'balanced' | 'strong';

export interface CompressionSettings {
  mode: CompressionMode;
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  pageCount: number;
  mode: CompressionMode;
  blob: Blob;
  fileName: string;
}

export interface SplitRange {
  start: number;
  end: number;
}

export interface GeneratedFile {
  fileName: string;
  blob: Blob;
  pageCount: number;
}

export interface ResultSummary {
  operation: ToolMode;
  files: GeneratedFile[];
  totalOriginalSize?: number;
  totalOutputSize: number;
  /** for zipped multi-file split output */
  isZip: boolean;
}

export interface ProgressState {
  active: boolean;
  label: string;
  percent?: number;
}

/** Limits used to warn the user before processing very large inputs. */
export const LIMITS = {
  MAX_FILE_SIZE_BYTES: 80 * 1024 * 1024, // 80MB per file warning threshold
  MAX_TOTAL_PAGES_WARNING: 300,
  MAX_THUMBNAIL_CONCURRENCY: 3,
};
