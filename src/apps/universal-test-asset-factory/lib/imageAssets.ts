import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import type { AssetGenerationOptions, GeneratedAsset } from '../types'
import { clamp, createSeededRandom } from './random'

const mimeByType = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const

function extName(type: 'jpg' | 'png' | 'webp'): string {
  return type === 'jpg' ? 'jpg' : type
}

function makeName(fileName: string | undefined, type: 'jpg' | 'png' | 'webp'): string {
  const base = (fileName ?? `test-${type}`).trim().replace(/\.[^.]+$/, '') || `test-${type}`
  return `${base}.${extName(type)}`
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Unable to encode image.'))), mimeType, quality)
  })
}

function drawDocumentBase(ctx: CanvasRenderingContext2D, width: number, height: number, transparent = false): void {
  if (!transparent) {
    ctx.fillStyle = '#f4f4ef'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,0.18)'
  ctx.shadowBlur = Math.max(8, width * 0.012)
  ctx.fillRect(width * 0.08, height * 0.05, width * 0.84, height * 0.9)
  ctx.shadowBlur = 0
}

function line(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = '#d6dae0'
  ctx.fillRect(x, y, w, 2)
}

function drawInvoice(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const left = width * 0.13
  const top = height * 0.1
  const contentW = width * 0.74
  ctx.fillStyle = '#111827'
  ctx.font = `700 ${Math.max(24, width * 0.045)}px Arial`
  ctx.fillText('INVOICE', left, top + width * 0.04)
  ctx.font = `${Math.max(13, width * 0.018)}px Arial`
  ctx.fillText('Invoice #INV-017-2026', left, top + width * 0.085)
  ctx.fillText('Date: 19 July 2026', left, top + width * 0.115)
  ctx.fillText('Bill To: Aarya Sharma', left, top + width * 0.145)
  ctx.fillText('Email: aarya.sharma@example.com', left, top + width * 0.175)

  const tableY = top + width * 0.24
  ctx.fillStyle = '#eef2f7'
  ctx.fillRect(left, tableY, contentW, width * 0.05)
  ctx.fillStyle = '#111827'
  ctx.font = `700 ${Math.max(11, width * 0.016)}px Arial`
  ctx.fillText('ITEM', left + 10, tableY + width * 0.032)
  ctx.fillText('QTY', left + contentW * 0.55, tableY + width * 0.032)
  ctx.fillText('PRICE', left + contentW * 0.7, tableY + width * 0.032)

  const rows = [
    ['Keyboard', '2', '₹1,499.00'],
    ['Monitor', '1', '₹9,499.00'],
    ['USB-C Cable', '3', '₹399.00'],
  ]
  ctx.font = `${Math.max(11, width * 0.016)}px Arial`
  rows.forEach((row, index) => {
    const y = tableY + width * (0.09 + index * 0.055)
    ctx.fillText(row[0], left + 10, y)
    ctx.fillText(row[1], left + contentW * 0.55, y)
    ctx.fillText(row[2], left + contentW * 0.7, y)
    line(ctx, left, y + width * 0.018, contentW)
  })
  ctx.font = `700 ${Math.max(14, width * 0.022)}px Arial`
  ctx.fillText('TOTAL: ₹12,694.00', left + contentW * 0.55, tableY + width * 0.3)
  ctx.font = `${Math.max(11, width * 0.016)}px Arial`
  ctx.fillText('Payment Status: PAID', left, tableY + width * 0.38)
  ctx.fillText('Thank you for testing 1 Hub Apps.', left, tableY + width * 0.43)
}

function drawOcrDocument(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const left = width * 0.13
  let y = height * 0.13
  ctx.fillStyle = '#111827'
  ctx.font = `700 ${Math.max(22, width * 0.036)}px Arial`
  ctx.fillText('OCR TEST DOCUMENT', left, y)
  y += width * 0.07
  ctx.font = `${Math.max(12, width * 0.017)}px Arial`
  const lines = [
    'Reference: OCR-017-A9X2',
    'Date: 19/07/2026   Time: 14:30',
    'Customer: Praveen Test User',
    'Phone: +91 98765 43210',
    'Email: demo.user@example.com',
    'Amount: INR 42,750.50',
    '',
    'This image contains high-contrast text intended for OCR testing.',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    'abcdefghijklmnopqrstuvwxyz',
    '0123456789 !@#$% & * ( ) + = / ?',
    '',
    'Table: Product | Quantity | Price',
    'Scanner | 1 | 2999.00',
    'Notebook | 5 | 125.50',
    'Cable | 3 | 399.00',
  ]
  lines.forEach((text) => {
    ctx.fillText(text, left, y)
    y += Math.max(24, width * 0.032)
  })
}

function drawForm(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const left = width * 0.13
  const right = width * 0.87
  let y = height * 0.14
  ctx.fillStyle = '#111827'
  ctx.font = `700 ${Math.max(22, width * 0.036)}px Arial`
  ctx.fillText('APPLICATION FORM', left, y)
  ctx.font = `${Math.max(12, width * 0.017)}px Arial`
  const fields = ['Full Name', 'Email Address', 'Phone Number', 'Street Address', 'City', 'Postal Code']
  y += width * 0.07
  fields.forEach((field) => {
    ctx.fillText(field, left, y)
    line(ctx, left, y + width * 0.025, right - left)
    y += width * 0.085
  })
  ctx.strokeStyle = '#111827'
  ctx.strokeRect(left, y, width * 0.025, width * 0.025)
  ctx.fillText('I agree to the test terms and conditions.', left + width * 0.04, y + width * 0.022)
  y += width * 0.09
  ctx.fillText('Signature', left, y)
  line(ctx, left, y + width * 0.04, width * 0.32)
  ctx.fillText('Date', left + width * 0.45, y)
  line(ctx, left + width * 0.45, y + width * 0.04, width * 0.2)
}

function drawTable(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const left = width * 0.12
  const top = height * 0.12
  const cols = [0, 0.12, 0.44, 0.63, 0.79, 1]
  const tableW = width * 0.76
  const rowH = height * 0.075
  const rows = [
    ['ID', 'Customer', 'Date', 'Status', 'Amount'],
    ['1001', 'Aarav Sharma', '2026-07-01', 'Paid', '₹1,250.00'],
    ['1002', 'Diya Patel', '2026-07-03', 'Pending', '₹5,499.90'],
    ['1003', 'Kabir Singh', '2026-07-05', 'Paid', '₹999.00'],
    ['1004', 'Meera Jain', '2026-07-08', 'Refunded', '₹3,275.50'],
  ]
  ctx.font = `${Math.max(10, width * 0.014)}px Arial`
  rows.forEach((row, rowIndex) => {
    const y = top + rowIndex * rowH
    ctx.fillStyle = rowIndex === 0 ? '#e5e7eb' : '#ffffff'
    ctx.fillRect(left, y, tableW, rowH)
    ctx.strokeStyle = '#9ca3af'
    ctx.strokeRect(left, y, tableW, rowH)
    row.forEach((cell, colIndex) => {
      const x = left + tableW * cols[colIndex] + 8
      ctx.fillStyle = '#111827'
      ctx.fillText(cell, x, y + rowH * 0.62)
    })
  })
}

async function drawQr(ctx: CanvasRenderingContext2D, width: number, height: number, text: string): Promise<void> {
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, text, { width: Math.floor(Math.min(width, height) * 0.5), margin: 2 })
  const x = (width - qr.width) / 2
  const y = (height - qr.height) / 2
  ctx.drawImage(qr, x, y)
  ctx.fillStyle = '#111827'
  ctx.font = `700 ${Math.max(16, width * 0.025)}px Arial`
  ctx.textAlign = 'center'
  ctx.fillText('QR TEST ASSET', width / 2, y - 24)
  ctx.textAlign = 'start'
}

function drawBarcode(ctx: CanvasRenderingContext2D, width: number, height: number, text: string): void {
  const barcode = document.createElement('canvas')
  JsBarcode(barcode, text, { format: 'CODE128', displayValue: true, margin: 16, width: 2, height: 100 })
  const scale = Math.min((width * 0.8) / barcode.width, (height * 0.5) / barcode.height)
  const w = barcode.width * scale
  const h = barcode.height * scale
  ctx.drawImage(barcode, (width - w) / 2, (height - h) / 2, w, h)
}

function applyNoise(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number, seed: number): void {
  if (amount <= 0) return
  const image = ctx.getImageData(0, 0, width, height)
  const random = createSeededRandom(seed)
  const strength = clamp(amount, 0, 100) * 0.9
  for (let index = 0; index < image.data.length; index += 4) {
    const delta = (random() - 0.5) * strength
    image.data[index] = clamp(image.data[index] + delta, 0, 255)
    image.data[index + 1] = clamp(image.data[index + 1] + delta, 0, 255)
    image.data[index + 2] = clamp(image.data[index + 2] + delta, 0, 255)
  }
  ctx.putImageData(image, 0, 0)
}

export async function generateImageAsset(options: AssetGenerationOptions): Promise<GeneratedAsset> {
  const assetType = options.assetType === 'jpg' || options.assetType === 'webp' ? options.assetType : 'png'
  const width = clamp(options.width ?? 1200, 320, 4096)
  const height = clamp(options.height ?? 1600, 240, 4096)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')

  drawDocumentBase(ctx, width, height, Boolean(options.transparent && assetType !== 'jpg'))
  const preset = options.preset ?? 'ocr-document'
  if (preset === 'invoice') drawInvoice(ctx, width, height)
  else if (preset === 'form') drawForm(ctx, width, height)
  else if (preset === 'table') drawTable(ctx, width, height)
  else if (preset === 'qr') await drawQr(ctx, width, height, options.qrText ?? 'https://1hub-apps.vercel.app')
  else if (preset === 'barcode') drawBarcode(ctx, width, height, options.barcodeText ?? '017202600001')
  else if (preset === 'test-pattern') {
    ctx.fillStyle = '#111827'
    ctx.font = `700 ${Math.max(24, width * 0.04)}px Arial`
    ctx.fillText(`${width} × ${height} TEST PATTERN`, width * 0.12, height * 0.16)
    for (let i = 0; i < 8; i += 1) {
      ctx.globalAlpha = 0.12 + i * 0.08
      ctx.fillRect(width * (0.12 + i * 0.08), height * 0.28, width * 0.06, height * 0.25)
    }
    ctx.globalAlpha = 1
    drawTable(ctx, width, height)
  } else drawOcrDocument(ctx, width, height)

  if (options.scanStyle) {
    ctx.fillStyle = 'rgba(80,70,50,0.045)'
    ctx.fillRect(0, 0, width, height)
  }
  applyNoise(ctx, width, height, options.noise ?? 0, options.seed ?? 17017)

  let outputCanvas = canvas
  const blur = clamp(options.blur ?? 0, 0, 10)
  const rotation = clamp(options.rotation ?? 0, -15, 15)
  const skew = clamp(options.skew ?? 0, -12, 12)
  if (blur > 0 || rotation !== 0 || skew !== 0) {
    const transformed = document.createElement('canvas')
    transformed.width = width
    transformed.height = height
    const out = transformed.getContext('2d')
    if (!out) throw new Error('Canvas is not supported in this browser.')
    if (assetType === 'jpg' || !options.transparent) {
      out.fillStyle = '#f4f4ef'
      out.fillRect(0, 0, width, height)
    }
    out.filter = blur > 0 ? `blur(${blur}px)` : 'none'
    out.translate(width / 2, height / 2)
    out.rotate((rotation * Math.PI) / 180)
    out.transform(1, 0, Math.tan((skew * Math.PI) / 180), 1, 0, 0)
    out.drawImage(canvas, -width / 2, -height / 2)
    outputCanvas = transformed
  }

  const mimeType = mimeByType[assetType]
  const blob = await canvasToBlob(outputCanvas, mimeType, assetType === 'jpg' ? 0.9 : 0.94)
  return {
    blob,
    fileName: makeName(options.fileName, assetType),
    mimeType,
    assetType,
    previewUrl: URL.createObjectURL(blob),
    summary: `${preset} ${assetType.toUpperCase()} test image at ${width}×${height}${options.scanStyle ? ' with scan styling' : ''}.`,
  }
}
