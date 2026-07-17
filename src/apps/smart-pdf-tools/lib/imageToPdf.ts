/**
 * Shared geometry helpers for placing an image onto a generated PDF page.
 *
 * These functions are used both by the live preview (ImagePageEditor, drawn
 * with CSS/canvas in screen pixels) and the final generator (pdfGenerator,
 * drawn with pdf-lib in PDF points), so the visual preview and the actual
 * output stay in sync.
 */

import type { ImagePlacement, Margin, Orientation, PageSize } from '../types';

// Points (1/72 inch), standard PDF units.
const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const LETTER_PORTRAIT = { width: 612, height: 792 };

const MARGIN_POINTS: Record<Margin, number> = {
  none: 0,
  small: 18, // ~0.25in
  normal: 36, // ~0.5in
};

export interface PageDimensions {
  width: number;
  height: number;
}

/**
 * Computes the final page dimensions (in points) for a given page size and
 * orientation, taking the source image's aspect ratio into account for
 * "auto" orientation and "fit" page size.
 */
export function resolvePageDimensions(
  pageSize: PageSize,
  orientation: Orientation,
  imageWidthPx: number,
  imageHeightPx: number
): PageDimensions {
  if (pageSize === 'fit') {
    // 96 CSS px per inch -> 72 points per inch
    const width = (imageWidthPx / 96) * 72;
    const height = (imageHeightPx / 96) * 72;
    return { width, height };
  }

  const base = pageSize === 'a4' ? A4_PORTRAIT : LETTER_PORTRAIT;
  let isLandscape: boolean;
  if (orientation === 'landscape') isLandscape = true;
  else if (orientation === 'portrait') isLandscape = false;
  else isLandscape = imageWidthPx > imageHeightPx; // auto

  return isLandscape ? { width: base.height, height: base.width } : { width: base.width, height: base.height };
}

export interface PlacedImageRect {
  /** top-left x of the image, in points from the page's top-left */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes where the image should be drawn on the page given the placement
 * settings (fit mode, margins, user offset/scale from the drag editor).
 * Coordinates are returned with (0,0) at the page's TOP-LEFT for easier
 * reasoning in the UI layer; callers targeting pdf-lib (bottom-left origin)
 * must flip the Y axis using the page height.
 */
export function computePlacedImageRect(
  placement: ImagePlacement,
  page: PageDimensions,
  imageWidthPx: number,
  imageHeightPx: number
): PlacedImageRect {
  const margin = MARGIN_POINTS[placement.margin];
  const areaWidth = Math.max(page.width - margin * 2, 1);
  const areaHeight = Math.max(page.height - margin * 2, 1);
  const imageAspect = imageWidthPx / imageHeightPx;
  const areaAspect = areaWidth / areaHeight;

  let baseWidth: number;
  let baseHeight: number;

  if (placement.fit === 'fill') {
    // Cover the full content area, cropping is implicit via clipping at draw time.
    if (imageAspect > areaAspect) {
      baseHeight = areaHeight;
      baseWidth = areaHeight * imageAspect;
    } else {
      baseWidth = areaWidth;
      baseHeight = areaWidth / imageAspect;
    }
  } else if (placement.fit === 'center') {
    // Draw at natural size (scaled to points), centered, not exceeding area.
    const natural = { width: (imageWidthPx / 96) * 72, height: (imageHeightPx / 96) * 72 };
    const shrink = Math.min(1, areaWidth / natural.width, areaHeight / natural.height);
    baseWidth = natural.width * shrink;
    baseHeight = natural.height * shrink;
  } else {
    // 'fit': entirely within the content area, preserving aspect ratio.
    if (imageAspect > areaAspect) {
      baseWidth = areaWidth;
      baseHeight = areaWidth / imageAspect;
    } else {
      baseHeight = areaHeight;
      baseWidth = areaHeight * imageAspect;
    }
  }

  const width = baseWidth * placement.scale;
  const height = baseHeight * placement.scale;

  // offsetX/offsetY (0..1) represent the image's center position within the
  // content area; 0.5/0.5 is centered.
  const centerX = margin + areaWidth * placement.offsetX;
  const centerY = margin + areaHeight * placement.offsetY;

  let x = centerX - width / 2;
  let y = centerY - height / 2;

  // Keep the image within page bounds (clamp, don't allow it to fully leave).
  x = Math.min(Math.max(x, margin - width + 20), page.width - margin - 20);
  y = Math.min(Math.max(y, margin - height + 20), page.height - margin - 20);

  return { x, y, width, height };
}
