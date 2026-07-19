export { formatFileSize as formatBytes } from '@shared/utils/files'
import type { CropAreaPixels, OutputFormat } from '../types';

const MAX_CANVAS_SIDE = 16384;



export function extensionForFormat(format: OutputFormat): string {
  if (format === 'image/jpeg') return 'jpg';
  if (format === 'image/png') return 'png';
  return 'webp';
}

export function fileNameWithoutExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '') || 'image';
}

export function createOutputFileName(fileName: string, format: OutputFormat): string {
  return `${fileNameWithoutExtension(fileName)}-processed.${extensionForFormat(format)}`;
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The selected image could not be loaded.'));
    image.src = url;
  });
}

function ensureValidDimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('Width and height must be positive numbers.');
  }
  if (width > MAX_CANVAS_SIDE || height > MAX_CANVAS_SIDE) {
    throw new Error(`Maximum supported side is ${MAX_CANVAS_SIDE}px.`);
  }
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  ensureValidDimensions(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('This browser could not create the processed image.'));
      },
      format,
      format === 'image/png' ? undefined : quality,
    );
  });
}

function paintBackgroundForJpeg(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  format: OutputFormat,
): void {
  if (format !== 'image/jpeg') return;
  context.save();
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.restore();
}

export async function processImage(options: {
  sourceUrl: string;
  outputFormat: OutputFormat;
  quality: number;
  targetWidth?: number;
  targetHeight?: number;
  crop?: CropAreaPixels;
  rotation?: number;
}): Promise<{ blob: Blob; width: number; height: number }> {
  const image = await loadImage(options.sourceUrl);
  const crop = options.crop;
  const rotation = options.rotation ?? 0;

  let drawable: CanvasImageSource = image;
  let drawableWidth = image.naturalWidth;
  let drawableHeight = image.naturalHeight;

  if (rotation !== 0) {
    const radians = (rotation * Math.PI) / 180;
    const absoluteCos = Math.abs(Math.cos(radians));
    const absoluteSin = Math.abs(Math.sin(radians));

    const rotatedWidth = Math.ceil(
      image.naturalWidth * absoluteCos +
        image.naturalHeight * absoluteSin,
    );
    const rotatedHeight = Math.ceil(
      image.naturalWidth * absoluteSin +
        image.naturalHeight * absoluteCos,
    );

    const rotationCanvas = makeCanvas(rotatedWidth, rotatedHeight);
    const rotationContext = rotationCanvas.getContext('2d');

    if (!rotationContext) {
      throw new Error('Canvas is not supported in this browser.');
    }

    rotationContext.imageSmoothingEnabled = true;
    rotationContext.imageSmoothingQuality = 'high';

    rotationContext.translate(rotatedWidth / 2, rotatedHeight / 2);
    rotationContext.rotate(radians);
    rotationContext.drawImage(
      image,
      -image.naturalWidth / 2,
      -image.naturalHeight / 2,
    );

    drawable = rotationCanvas;
    drawableWidth = rotatedWidth;
    drawableHeight = rotatedHeight;
  }

  const sourceX = crop?.x ?? 0;
  const sourceY = crop?.y ?? 0;
  const sourceWidth = crop?.width ?? drawableWidth;
  const sourceHeight = crop?.height ?? drawableHeight;

  const width = Math.round(options.targetWidth ?? sourceWidth);
  const height = Math.round(options.targetHeight ?? sourceHeight);
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Canvas is not supported in this browser.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  paintBackgroundForJpeg(context, width, height, options.outputFormat);

  context.drawImage(
    drawable,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );

  const blob = await canvasToBlob(
    canvas,
    options.outputFormat,
    options.quality,
  );

  return { blob, width, height };
}
