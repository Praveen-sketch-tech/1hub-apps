// App #003 — QR & Barcode Studio
// Opens a clean, print-specific window containing only the generated
// QR/barcode image, rather than printing the entire application UI.

export interface PrintPayload {
  imageDataUrl: string;
  title?: string;
  value?: string;
}

export function printImage({ imageDataUrl, title, value }: PrintPayload): void {
  const printWindow = window.open('', '_blank', 'width=480,height=640');
  if (!printWindow) {
    throw new Error('Could not open the print window. Please allow pop-ups for this site.');
  }

  const safeTitle = title ? escapeHtml(title) : '';
  const safeValue = value ? escapeHtml(value) : '';

  printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle || 'Print code'}</title>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        font-family: system-ui, -apple-system, sans-serif;
        background: #ffffff;
      }
      .qbs-print-wrap {
        text-align: center;
        padding: 24px;
      }
      .qbs-print-wrap img {
        max-width: 100%;
        height: auto;
      }
      .qbs-print-title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 12px;
      }
      .qbs-print-value {
        margin-top: 12px;
        font-size: 12px;
        color: #444;
        word-break: break-all;
      }
      @media print {
        .qbs-print-wrap { padding: 0; }
      }
    </style>
  </head>
  <body>
    <div class="qbs-print-wrap">
      ${safeTitle ? `<div class="qbs-print-title">${safeTitle}</div>` : ''}
      <img src="${imageDataUrl}" alt="Generated code" />
      ${safeValue ? `<div class="qbs-print-value">${safeValue}</div>` : ''}
    </div>
  </body>
</html>`);

  printWindow.document.close();
  printWindow.focus();

  // Give the image a moment to paint before invoking print.
  printWindow.onload = () => {
    printWindow.print();
  };
  setTimeout(() => {
    printWindow.print();
  }, 300);
}

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
