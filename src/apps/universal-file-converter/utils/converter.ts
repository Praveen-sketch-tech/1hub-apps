export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';
export type TextFormat = 'txt' | 'md' | 'html' | 'json' | 'csv' | 'pdf';
export interface ConvertedFileResult {
blob: Blob;
url: string;
filename: string;
size: number;
}
export const convertImageFile = (
file: File,
targetFormat: ImageFormat,
quality: number = 0.92,
maxWidth?: number,
maxHeight?: number
): Promise<ConvertedFileResult> => {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = (event) => {
const img = new Image();
img.onload = () => {
let width = img.width;
let height = img.height;
if (maxWidth && width > maxWidth) {
height = Math.round((height * maxWidth) / width);
width = maxWidth;
}
if (maxHeight && height > maxHeight) {
width = Math.round((width * maxHeight) / height);
height = maxHeight;
}
const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext('2d');
if (!ctx) {
reject(new Error('Failed to create canvas context'));
return;
}
if (targetFormat === 'image/jpeg') {
ctx.fillStyle = '#FFFFFF';
ctx.fillRect(0, 0, width, height);
}
ctx.drawImage(img, 0, 0, width, height);
canvas.toBlob(
(blob) => {
if (!blob) {
reject(new Error('Blob conversion failed'));
return;
}
const ext = targetFormat === 'image/jpeg' ? 'jpg' : targetFormat === 'image/png' ? 'png' : 'webp';
const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'converted_image';
const filename = `${baseName}.${ext}`;
const url = URL.createObjectURL(blob);
resolve({
blob,
url,
filename,
size: blob.size,
});
},
targetFormat,
quality
);
};
img.onerror = () => reject(new Error('Failed to load image file'));
img.src = event.target?.result as string;
};
reader.onerror = () => reject(new Error('Failed to read image file'));
reader.readAsDataURL(file);
});
};
export const createTextFileBlob = (
text: string,
filename: string,
format: TextFormat
): ConvertedFileResult => {
let mimeType = 'text/plain';
const extension = format;
switch (format) {
case 'json':
mimeType = 'application/json';
break;
case 'html':
mimeType = 'text/html';
break;
case 'csv':
mimeType = 'text/csv';
break;
case 'md':
mimeType = 'text/markdown';
break;
case 'txt':
default:
mimeType = 'text/plain';
break;
}
const cleanName = filename.replace(/.[^/.]+$/, '');
const finalFilename = `${cleanName}.${extension}`;
const blob = new Blob([text], { type: mimeType });
const url = URL.createObjectURL(blob);
return {
blob,
url,
filename: finalFilename,
size: blob.size,
};
};
export const createPdfFromText = (
text: string,
title: string = 'Document'
): ConvertedFileResult => {
const sanitizedTitle = title.replace(/[()]/g, '');
const lines = text.split('\n');
let pdfTextStream = `BT\n/F1 12 Tf\n36 750 Td\n16 TL\n`;
pdfTextStream += `(${sanitizedTitle}) Tj T*\nT*\n`;
lines.forEach((line) => {
const cleanLine = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
pdfTextStream += `(${cleanLine}) Tj T*\n`;
});
pdfTextStream += `ET`;
const pdfBody = `%PDF-1.4 1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj 2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj 3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj 4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj 5 0 obj << /Length ${pdfTextStream.length} >> stream ${pdfTextStream} endstream endobj xref 0 6 0000000000 65535 f  0000000009 00000 n  0000000058 00000 n  0000000115 00000 n  0000000242 00000 n  0000000310 00000 n  trailer << /Size 6 /Root 1 0 R >> startxref ${400 + pdfTextStream.length} %%EOF`;
const blob = new Blob([pdfBody], { type: 'application/pdf' });
const url = URL.createObjectURL(blob);
const cleanTitle = title.trim().toLowerCase().replace(/\s+/g, '_') || 'document';
return {
blob,
url,
filename: `${cleanTitle}.pdf`,
size: blob.size,
};
};
export const convertJsonToCsv = (jsonString: string): string => {
try {
const data = JSON.parse(jsonString);
const array = Array.isArray(data) ? data : [data];
if (array.length === 0) return '';
const headers = Object.keys(array[0]);
const csvRows = [];
csvRows.push(headers.join(','));
for (const row of array) {
const values = headers.map((header) => {
const val = row[header];
const escaped = ('' + (val ?? '')).replace(/"/g, '\"');
return `"${escaped}"`;
});
csvRows.push(values.join(','));
}
return csvRows.join('\n');
} catch {
throw new Error('Invalid JSON structure. Please provide a JSON array of objects.');
}
};