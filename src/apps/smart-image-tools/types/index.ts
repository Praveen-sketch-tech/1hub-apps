export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export type ToolMode = 'compress' | 'resize' | 'convert' | 'crop';

export interface ImageMeta {
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
}

export interface ResizeSettings {
  width: number;
  height: number;
  lockAspectRatio: boolean;
}

export interface CropAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessedImage {
  blob: Blob;
  url: string;
  fileName: string;
  width: number;
  height: number;
}
