import type { ParagraphModel } from '../types';

export interface PdfTextModel {
  paragraphs: ParagraphModel[];
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseLabelValue(text: string): { label: string; value: string } | null {
  const cleaned = cleanText(text);

  if (!cleaned) return null;

  const match = cleaned.match(/^([^:]{1,100}):\s*(.+)$/);
  if (!match) return null;

  const label = match[1].trim();
  const value = match[2].trim();

  if (!label || !value) return null;

  return { label, value };
}

export async function parsePdfText(file: File): Promise<PdfTextModel> {
  const pdfjs = await import('pdfjs-dist');

  // Vite/browser-compatible PDF.js worker configuration.
  // The worker is loaded from the same installed pdfjs-dist package.
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const loadingTask = pdfjs.getDocument({
    data: bytes
  });

  const pdf = await loadingTask.promise;

  const paragraphs: ParagraphModel[] = [];
  let paragraphIndex = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const items = textContent.items
      .filter(
        (item): item is typeof item & { str: string } =>
          'str' in item && typeof item.str === 'string'
      )
      .map((item) => ({
        text: cleanText(item.str),
        x: 'transform' in item ? item.transform[4] : 0,
        y: 'transform' in item ? item.transform[5] : 0
      }))
      .filter((item) => item.text);

    const lines: { y: number; parts: typeof items }[] = [];

    for (const item of items) {
      let line = lines.find((l) => Math.abs(l.y - item.y) <= 3);

      if (!line) {
        line = { y: item.y, parts: [] };
        lines.push(line);
      }

      line.parts.push(item);
    }

    lines.sort((a, b) => b.y - a.y);

    for (const line of lines) {
      line.parts.sort((a, b) => a.x - b.x);

      const text = cleanText(line.parts.map((p) => p.text).join(' '));
      if (!text) continue;

      const pair = parseLabelValue(text);

      paragraphs.push({
        index: paragraphIndex++,
        text,
        bold: false,
        align: 'left',
        headingLevel: 0,
        isLabelValue: !!pair,
        ...(pair
          ? {
              label: pair.label,
              value: pair.value
            }
          : {})
      });
    }
  }

  if (paragraphs.length === 0) {
    throw new Error(
      'This PDF has no selectable text. Scanned/image-only PDFs are not supported yet (Phase 2).'
    );
  }

  const labelValueCount = paragraphs.filter((p) => p.isLabelValue).length;

  if (labelValueCount === 0) {
    throw new Error(
      'PDF contains selectable text, but no "Label: Value" fields were detected.'
    );
  }

  return { paragraphs };
}
