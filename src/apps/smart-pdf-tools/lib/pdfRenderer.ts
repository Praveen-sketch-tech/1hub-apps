/**
 * A small concurrency-limited queue for thumbnail rendering.
 *
 * Rendering many PDF pages or images to canvas back-to-back can freeze the
 * UI. This queue caps how many render jobs run "in flight" at once and lets
 * the browser breathe between batches.
 */

import { LIMITS } from '../types';

type Job<T> = () => Promise<T>;

export class RenderQueue {
  private concurrency: number;
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(concurrency = LIMITS.MAX_THUMBNAIL_CONCURRENCY) {
    this.concurrency = concurrency;
  }

  async run<T>(job: Job<T>): Promise<T> {
    await this.acquire();
    try {
      return await job();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.concurrency) {
      this.running += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.running += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.running -= 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

/** Shared queue instance used across the workspace for thumbnail rendering. */
export const thumbnailQueue = new RenderQueue();

/**
 * Renders an image file to a thumbnail object URL, scaled down for display.
 * Used for image-derived pages (as opposed to PDF-derived pages).
 */
export async function renderImageThumbnail(bytes: ArrayBuffer, mimeType: string, maxDimension = 320): Promise<string> {
  const blob = new Blob([bytes], { type: mimeType });
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = maxDimension / Math.max(bitmap.width, bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * Math.min(scale, 1)));
    const height = Math.max(1, Math.round(bitmap.height * Math.min(scale, 1)));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const outBlob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!outBlob) throw new Error('Failed to generate image thumbnail.');
    return URL.createObjectURL(outBlob);
  } finally {
    bitmap.close();
  }
}

/** Reads the natural pixel dimensions of an image from its raw bytes. */
export async function getImageDimensions(bytes: ArrayBuffer, mimeType: string): Promise<{ width: number; height: number }> {
  const blob = new Blob([bytes], { type: mimeType });
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
