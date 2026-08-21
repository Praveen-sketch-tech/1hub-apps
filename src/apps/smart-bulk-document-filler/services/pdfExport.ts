import type { ParagraphModel } from '../types';

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function fontSizeForHeading(level: 0 | 1 | 2 | 3): number {
  if (level === 1) return 18;
  if (level === 2) return 15;
  if (level === 3) return 13;
  return 11;
}

export async function renderParagraphsAsPdf(paragraphs: ParagraphModel[]): Promise<Blob> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - MARGIN;
  };

  const wrapText = (text: string, font: typeof regularFont, size: number, maxWidth: number): string[] => {
    if (!text) return [''];
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) lines.push(current);
    return lines;
  };

  paragraphs.forEach((para) => {
    const font = para.bold ? boldFont : regularFont;
    const size = fontSizeForHeading(para.headingLevel);
    const lineHeight = size * 1.4;

    if (!para.text.trim()) {
      cursorY -= lineHeight * 0.6;
      return;
    }

    const lines = wrapText(para.text, font, size, CONTENT_WIDTH);

    lines.forEach((line) => {
      if (cursorY - lineHeight < MARGIN) {
        newPage();
      }
      const textWidth = font.widthOfTextAtSize(line, size);
      let x = MARGIN;
      if (para.align === 'center') x = MARGIN + (CONTENT_WIDTH - textWidth) / 2;
      else if (para.align === 'right') x = MARGIN + (CONTENT_WIDTH - textWidth);

      page.drawText(line, { x, y: cursorY - size, size, font });
      cursorY -= lineHeight;
    });

    if (para.headingLevel > 0) cursorY -= 4; // small extra gap after headings
  });

  const bytes = await pdfDoc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}
