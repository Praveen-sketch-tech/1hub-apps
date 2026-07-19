// ============================================================================
// Minimal, dependency-free EXIF / TIFF parser.
//
// This intentionally supports only the tags this app displays. It reads the
// TIFF structure embedded in a JPEG "APP1 Exif" segment or a WebP "EXIF"
// RIFF chunk and returns a flat map of decoded tag values. It does not
// attempt to be a complete EXIF library.
// ============================================================================

export interface RawExifData {
  ifd0: Record<number, TagValue>;
  exifIfd: Record<number, TagValue>;
  gpsIfd: Record<number, TagValue>;
}

type TagValue = string | number | number[] | undefined;

const TIFF_TYPE_SIZES: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  6: 1, // SBYTE
  7: 1, // UNDEFINED
  8: 2, // SSHORT
  9: 4, // SLONG
  10: 8, // SRATIONAL
  11: 4, // FLOAT
  12: 8, // DOUBLE
};

/** Locate and parse the TIFF/EXIF block inside a JPEG ArrayBuffer. */
export function parseJpegExif(buffer: ArrayBuffer): RawExifData | null {
  const view = new DataView(buffer);
  if (view.getUint16(0) !== 0xffd8) return null; // not a JPEG

  let offset = 2;
  while (offset < view.byteLength - 4) {
    const marker = view.getUint16(offset);
    if (marker === 0xffd9 || marker === 0xffda) break; // EOI or start-of-scan
    if ((marker & 0xff00) !== 0xff00) break; // malformed

    const segmentLength = view.getUint16(offset + 2);
    if (marker === 0xffe1) {
      // APP1 — check for "Exif\0\0" header
      const headerStart = offset + 4;
      const isExif =
        view.getUint32(headerStart) === 0x45786966 && view.getUint16(headerStart + 4) === 0x0000;
      if (isExif) {
        const tiffStart = headerStart + 6;
        try {
          return parseTiff(view, tiffStart);
        } catch {
          return null;
        }
      }
    }
    offset += 2 + segmentLength;
  }
  return null;
}

/** Locate and parse an EXIF chunk inside a WebP RIFF container. */
export function parseWebpExif(buffer: ArrayBuffer): RawExifData | null {
  const view = new DataView(buffer);
  if (view.getUint32(0) !== 0x52494646) return null; // "RIFF"
  if (view.getUint32(8) !== 0x57454250) return null; // "WEBP"

  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const fourCC = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    const chunkSize = view.getUint32(offset + 4, true);
    if (fourCC === 'EXIF') {
      const tiffStart = offset + 8;
      try {
        return parseTiff(view, tiffStart);
      } catch {
        return null;
      }
    }
    offset += 8 + chunkSize + (chunkSize % 2); // chunks are padded to even size
  }
  return null;
}

function parseTiff(view: DataView, tiffStart: number): RawExifData {
  const byteOrderMark = view.getUint16(tiffStart);
  const littleEndian = byteOrderMark === 0x4949; // "II"
  if (!littleEndian && byteOrderMark !== 0x4d4d) {
    throw new Error('Invalid TIFF byte order marker');
  }

  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
  const ifd0 = readIfd(view, tiffStart, tiffStart + ifd0Offset, littleEndian);

  let exifIfd: Record<number, TagValue> = {};
  const exifPointer = ifd0[0x8769];
  if (typeof exifPointer === 'number') {
    exifIfd = readIfd(view, tiffStart, tiffStart + exifPointer, littleEndian);
  }

  let gpsIfd: Record<number, TagValue> = {};
  const gpsPointer = ifd0[0x8825];
  if (typeof gpsPointer === 'number') {
    gpsIfd = readIfd(view, tiffStart, tiffStart + gpsPointer, littleEndian, true);
  }

  return { ifd0, exifIfd, gpsIfd };
}

function readIfd(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean,
  isGps = false,
): Record<number, TagValue> {
  const result: Record<number, TagValue> = {};
  if (ifdOffset + 2 > view.byteLength) return result;

  const entryCount = view.getUint16(ifdOffset, littleEndian);
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);
    const typeSize = TIFF_TYPE_SIZES[type] ?? 1;
    const valueBytes = typeSize * count;

    const valueOffset =
      valueBytes <= 4 ? entryOffset + 8 : tiffStart + view.getUint32(entryOffset + 8, littleEndian);

    try {
      result[tag] = readTagValue(view, valueOffset, type, count, littleEndian, isGps && (tag === 2 || tag === 4));
    } catch {
      // skip unreadable tag
    }
  }
  return result;
}

function readTagValue(
  view: DataView,
  offset: number,
  type: number,
  count: number,
  littleEndian: boolean,
  asRationalArray = false,
): TagValue {
  switch (type) {
    case 2: {
      // ASCII
      const bytes: number[] = [];
      for (let i = 0; i < count; i++) {
        const b = view.getUint8(offset + i);
        if (b === 0) break;
        bytes.push(b);
      }
      return String.fromCharCode(...bytes).trim();
    }
    case 1: // BYTE
    case 6: // SBYTE
      return view.getUint8(offset);
    case 3: // SHORT
      return view.getUint16(offset, littleEndian);
    case 4: // LONG
      return view.getUint32(offset, littleEndian);
    case 9: // SLONG
      return view.getInt32(offset, littleEndian);
    case 5: {
      // RATIONAL — used heavily by GPS (arrays of 3) and single values
      if (count > 1 || asRationalArray) {
        const values: number[] = [];
        for (let i = 0; i < count; i++) {
          const num = view.getUint32(offset + i * 8, littleEndian);
          const den = view.getUint32(offset + i * 8 + 4, littleEndian);
          values.push(den === 0 ? 0 : num / den);
        }
        return values;
      }
      const num = view.getUint32(offset, littleEndian);
      const den = view.getUint32(offset + 4, littleEndian);
      return den === 0 ? 0 : num / den;
    }
    case 10: {
      // SRATIONAL
      const num = view.getInt32(offset, littleEndian);
      const den = view.getInt32(offset + 4, littleEndian);
      return den === 0 ? 0 : num / den;
    }
    default:
      return undefined;
  }
}

/** Convert a GPS [deg, min, sec] rational array + ref letter into signed decimal degrees. */
export function dmsToDecimal(dms: number[] | undefined, ref: string | undefined): number | null {
  if (!dms || dms.length < 3) return null;
  const [deg, min, sec] = dms;
  let decimal = deg + min / 60 + sec / 3600;
  if (ref === 'S' || ref === 'W') decimal *= -1;
  return decimal;
}
