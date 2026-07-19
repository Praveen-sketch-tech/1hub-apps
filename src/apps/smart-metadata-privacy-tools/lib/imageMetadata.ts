import { parseJpegExif, parseWebpExif, dmsToDecimal, type RawExifData } from './exifParser';
import type { MetadataGroup, MetadataField } from './types';

const ORIENTATION_LABELS: Record<number, string> = {
  1: 'Normal',
  2: 'Flipped horizontally',
  3: 'Rotated 180°',
  4: 'Flipped vertically',
  5: 'Rotated 90° CW + flipped',
  6: 'Rotated 90° CW',
  7: 'Rotated 90° CCW + flipped',
  8: 'Rotated 90° CCW',
};

export interface ImageMetadataResult {
  groups: MetadataGroup[];
  hasGps: boolean;
  hasAnyExif: boolean;
  dimensions: { width: number; height: number } | null;
  warnings: string[];
}

function field(key: string, label: string, value: unknown, sensitive = false, note?: string): MetadataField | null {
  if (value === undefined || value === null || value === '') return null;
  return { key, label, value: String(value), sensitive, note };
}

function buildGroupsFromExif(raw: RawExifData, warnings: string[]): { groups: MetadataGroup[]; hasGps: boolean } {
  const { ifd0, exifIfd, gpsIfd } = raw;
  const cameraFields: MetadataField[] = [];
  const timeFields: MetadataField[] = [];
  const attributionFields: MetadataField[] = [];
  const gpsFields: MetadataField[] = [];
  const technicalFields: MetadataField[] = [];

  const push = (arr: MetadataField[], f: MetadataField | null) => {
    if (f) arr.push(f);
  };

  push(cameraFields, field('make', 'Camera Make', ifd0[0x010f], true, 'Identifies the device manufacturer.'));
  push(cameraFields, field('model', 'Camera Model', ifd0[0x0110], true, 'Identifies the exact device model.'));
  push(cameraFields, field('software', 'Software', ifd0[0x0131], true, 'Editing or capture software used.'));

  const orientationRaw = ifd0[0x0112];
  if (typeof orientationRaw === 'number') {
    push(cameraFields, field('orientation', 'Orientation', ORIENTATION_LABELS[orientationRaw] ?? `Value ${orientationRaw}`));
  }

  push(timeFields, field('dateTime', 'Date/Time', ifd0[0x0132], true, 'When the file was last modified by the camera or software.'));
  push(timeFields, field('dateTimeOriginal', 'Date/Time Original', exifIfd[0x9003], true, 'When the photo was originally taken.'));
  push(timeFields, field('dateTimeDigitized', 'Date/Time Digitized', exifIfd[0x9004], true));

  push(attributionFields, field('artist', 'Artist', ifd0[0x013b], true, 'Personal or business name embedded by the camera/editor.'));
  push(attributionFields, field('copyright', 'Copyright', ifd0[0x8298], false));

  const width = exifIfd[0xa002];
  const height = exifIfd[0xa003];
  if (typeof width === 'number') push(technicalFields, field('exifWidth', 'Pixel Width (EXIF)', width));
  if (typeof height === 'number') push(technicalFields, field('exifHeight', 'Pixel Height (EXIF)', height));

  const exposure = exifIfd[0x829a];
  if (typeof exposure === 'number') push(technicalFields, field('exposureTime', 'Exposure Time', `${exposure < 1 ? `1/${Math.round(1 / exposure)}` : exposure} s`));
  const fNumber = exifIfd[0x829d];
  if (typeof fNumber === 'number') push(technicalFields, field('fNumber', 'Aperture (f-number)', `f/${fNumber.toFixed(1)}`));
  const iso = exifIfd[0x8827];
  if (iso !== undefined) push(technicalFields, field('iso', 'ISO Speed', Array.isArray(iso) ? iso.join(', ') : iso));
  const focalLength = exifIfd[0x920a];
  if (typeof focalLength === 'number') push(technicalFields, field('focalLength', 'Focal Length', `${focalLength.toFixed(1)} mm`));

  // GPS
  const latDms = gpsIfd[2] as number[] | undefined;
  const lonDms = gpsIfd[4] as number[] | undefined;
  const latRef = gpsIfd[1] as string | undefined;
  const lonRef = gpsIfd[3] as string | undefined;
  const lat = dmsToDecimal(latDms, latRef);
  const lon = dmsToDecimal(lonDms, lonRef);
  let hasGps = false;
  if (lat !== null && lon !== null) {
    hasGps = true;
    push(gpsFields, field('gpsLatitude', 'GPS Latitude', lat.toFixed(6), true, 'Precise location where the photo was taken.'));
    push(gpsFields, field('gpsLongitude', 'GPS Longitude', lon.toFixed(6), true, 'Precise location where the photo was taken.'));
  }
  const altitude = gpsIfd[6];
  if (typeof altitude === 'number') {
    push(gpsFields, field('gpsAltitude', 'GPS Altitude', `${altitude.toFixed(1)} m`, true));
  }
  const gpsTimestamp = gpsIfd[7] as number[] | undefined;
  if (Array.isArray(gpsTimestamp) && gpsTimestamp.length === 3) {
    const [h, m, s] = gpsTimestamp;
    push(gpsFields, field('gpsTime', 'GPS Timestamp (UTC)', `${pad(h)}:${pad(m)}:${pad(s)}`, true));
  }

  const groups: MetadataGroup[] = [];
  if (cameraFields.length) groups.push({ title: 'Camera & Device', fields: cameraFields });
  if (timeFields.length) groups.push({ title: 'Date & Time', fields: timeFields });
  if (gpsFields.length) groups.push({ title: 'GPS Location', fields: gpsFields });
  if (attributionFields.length) groups.push({ title: 'Attribution', fields: attributionFields });
  if (technicalFields.length) groups.push({ title: 'Technical Details', fields: technicalFields });

  if (!groups.length) {
    warnings.push('No readable EXIF fields were found in this file.');
  }

  return { groups, hasGps };
}

function pad(n: number): string {
  return String(Math.round(n)).padStart(2, '0');
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return null;
  }
}

/** Read simple tEXt/iTXt chunks from a PNG buffer (Author/Description/Software etc). */
function readPngTextChunks(buffer: ArrayBuffer): { fields: MetadataField[]; dimensions: { width: number; height: number } | null } {
  const view = new DataView(buffer);
  const fields: MetadataField[] = [];
  let dimensions: { width: number; height: number } | null = null;

  // PNG signature is 8 bytes
  let offset = 8;
  while (offset + 8 <= view.byteLength) {
    const length = view.getUint32(offset);
    const typeBytes = [
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7),
    ];
    const type = String.fromCharCode(...typeBytes);
    const dataStart = offset + 8;

    if (type === 'IHDR' && dataStart + 8 <= view.byteLength) {
      dimensions = {
        width: view.getUint32(dataStart),
        height: view.getUint32(dataStart + 4),
      };
    } else if (type === 'tEXt') {
      const bytes: number[] = [];
      for (let i = 0; i < length; i++) bytes.push(view.getUint8(dataStart + i));
      const text = String.fromCharCode(...bytes);
      const nullIndex = text.indexOf('\u0000');
      if (nullIndex > -1) {
        const key = text.slice(0, nullIndex);
        const value = text.slice(nullIndex + 1);
        if (key && value) {
          fields.push({ key: `png-${key}`, label: key, value, sensitive: /author|artist|location|gps/i.test(key) });
        }
      }
    } else if (type === 'tIME' && dataStart + 7 <= view.byteLength) {
      const year = view.getUint16(dataStart);
      const month = view.getUint8(dataStart + 2);
      const day = view.getUint8(dataStart + 3);
      const hour = view.getUint8(dataStart + 4);
      const min = view.getUint8(dataStart + 5);
      const sec = view.getUint8(dataStart + 6);
      fields.push({
        key: 'png-tIME',
        label: 'Last Modified (PNG tIME)',
        value: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(min)}:${pad(sec)}`,
        sensitive: true,
      });
    } else if (type === 'IEND') {
      break;
    }

    offset = dataStart + length + 4; // skip data + CRC
  }

  return { fields, dimensions };
}

export async function inspectImageMetadata(file: File): Promise<ImageMetadataResult> {
  const warnings: string[] = [];
  const buffer = await file.arrayBuffer();
  const dimensions = await readImageDimensions(file);

  const mimeOrName = (file.type || file.name).toLowerCase();

  if (mimeOrName.includes('png')) {
    const { fields, dimensions: pngDims } = readPngTextChunks(buffer);
    const groups: MetadataGroup[] = fields.length ? [{ title: 'Embedded Text Metadata', fields }] : [];
    if (!groups.length) warnings.push('No embedded text metadata (tEXt/iTXt) was found in this PNG.');
    warnings.push('PNG files rarely embed GPS or camera EXIF data; only text chunks were checked.');
    return {
      groups,
      hasGps: false,
      hasAnyExif: fields.length > 0,
      dimensions: dimensions ?? pngDims,
      warnings,
    };
  }

  let raw: RawExifData | null = null;
  try {
    if (mimeOrName.includes('webp')) {
      raw = parseWebpExif(buffer);
    } else {
      raw = parseJpegExif(buffer);
    }
  } catch {
    warnings.push('The file could not be fully parsed for EXIF data; it may be corrupted or use an unsupported variant.');
  }

  if (!raw) {
    warnings.push('No EXIF block was found in this file.');
    return { groups: [], hasGps: false, hasAnyExif: false, dimensions, warnings };
  }

  const { groups, hasGps } = buildGroupsFromExif(raw, warnings);
  const hasAnyExif = groups.length > 0;
  return { groups, hasGps, hasAnyExif, dimensions, warnings };
}
