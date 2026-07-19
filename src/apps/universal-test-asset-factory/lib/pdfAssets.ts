import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import QRCode from 'qrcode'
import type { AssetGenerationOptions, GeneratedAsset } from '../types'
import { clamp } from './random'

function fileName(name?: string): string {
  const base = (name ?? 'sample-document').trim().replace(/\.[^.]+$/, '') || 'sample-document'
  return `${base}.pdf`
}

async function qrPngBytes(text: string): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(text, { width: 256, margin: 1 })
  const base64 = dataUrl.split(',')[1] ?? ''
  const binary = atob(base64)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export async function generatePdfAsset(options: AssetGenerationOptions): Promise<GeneratedAsset> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('1 Hub Apps Universal Test Asset Factory')
  pdf.setAuthor('1 Hub Apps')
  pdf.setSubject('Reusable browser-generated test document')
  pdf.setKeywords(['test asset', 'ocr', 'invoice', 'sample document'])
  pdf.setCreator('Universal Test Asset Factory')
  pdf.setProducer('pdf-lib')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pageCount = clamp(options.pageCount ?? 3, 1, 20)
  const preset = options.preset ?? 'scanned-document'
  let qrImage: Awaited<ReturnType<typeof pdf.embedPng>> | undefined
  if (options.includeQr) qrImage = await pdf.embedPng(await qrPngBytes(options.qrText ?? 'https://1hub-apps.vercel.app'))

  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([595.28, 841.89])
    const { width, height } = page.getSize()
    const rotation = preset === 'scanned-document' || options.scanStyle ? (index % 2 === 0 ? 0.5 : -0.7) : 0
    page.setRotation(degrees(rotation))

    page.drawRectangle({ x: 36, y: 36, width: width - 72, height: height - 72, color: rgb(0.98, 0.98, 0.965) })
    page.drawText(preset === 'invoice' ? `INVOICE ${String(index + 1).padStart(2, '0')}` : `OCR TEST DOCUMENT — PAGE ${index + 1}`, {
      x: 64,
      y: height - 100,
      size: 22,
      font: bold,
      color: rgb(0.08, 0.1, 0.14),
    })
    const body = [
      `Reference: DOC-017-${1000 + index}`,
      `Date: ${String(19 - index).padStart(2, '0')}/07/2026`,
      'Customer: Aarya Sharma',
      'Email: aarya.sharma@example.com',
      'Phone: +91 98765 43210',
      `Amount: INR ${(12450.75 + index * 325.5).toFixed(2)}`,
      '',
      'This page contains structured, OCR-readable text for document testing.',
      'It includes headings, numbers, currency, dates, email and tabular content.',
      '',
      'Item                 Qty         Unit Price        Total',
      'Keyboard              2          1499.00          2998.00',
      'Monitor               1          9499.00          9499.00',
      'Cable                 3           399.00          1197.00',
    ]
    let y = height - 145
    body.forEach((text) => {
      page.drawText(text, { x: 64, y, size: 11, font, color: rgb(0.12, 0.13, 0.16) })
      y -= 22
    })

    page.drawRectangle({ x: 64, y: 220, width: 14, height: 14, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 1 })
    page.drawText('Form checkbox — sample consent field', { x: 88, y: 222, size: 10, font })
    page.drawText('Signature: ____________________________', { x: 64, y: 170, size: 11, font })
    page.drawText('Date: __________________', { x: 360, y: 170, size: 11, font })

    if (qrImage) page.drawImage(qrImage, { x: width - 160, y: 58, width: 80, height: 80 })

    if (preset === 'scanned-document' || options.scanStyle) {
      for (let n = 0; n < 24; n += 1) {
        const x = 50 + ((n * 83) % 480)
        const yy = 55 + ((n * 137) % 720)
        page.drawCircle({ x, y: yy, size: 0.6 + (n % 3) * 0.3, color: rgb(0.55, 0.52, 0.48), opacity: 0.18 })
      }
    }
  }

  const bytes = await pdf.save()
  const pdfBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(pdfBuffer).set(bytes)
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
  return {
    blob,
    fileName: fileName(options.fileName),
    mimeType: 'application/pdf',
    assetType: 'pdf',
    summary: `${pageCount}-page ${preset} PDF with OCR-readable text, tables, form fields${options.includeQr ? ' and QR content' : ''}.`,
  }
}
