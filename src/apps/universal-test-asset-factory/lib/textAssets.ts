import type { GeneratedAsset } from '../types'
import { generateSampleRecords } from './dataFactory'

function downloadName(name: string | undefined, fallback: string, ext: string): string {
  const clean = (name ?? fallback).trim().replace(/\.[^.]+$/, '') || fallback
  return `${clean}.${ext}`
}

export async function generateCsvAsset(options: {
  fileName?: string
  rowCount?: number
  includeDuplicates?: boolean
  includeMissingValues?: boolean
  seed?: number
}): Promise<GeneratedAsset> {
  const rows = generateSampleRecords(options)
  const headers = ['id', 'customer', 'email', 'city', 'category', 'status', 'orderDate', 'quantity', 'unitPrice', 'discount', 'total']
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const csv = [headers.join(','), ...rows.map((row) => headers.map((key) => escape(row[key as keyof typeof row])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  return {
    blob,
    fileName: downloadName(options.fileName, 'sample-data', 'csv'),
    mimeType: 'text/csv',
    assetType: 'csv',
    summary: `Structured CSV with ${rows.length} rows, dates, currency-style numeric fields${options.includeDuplicates ? ', duplicate rows' : ''}${options.includeMissingValues ? ', and missing values' : ''}.`,
  }
}

export async function generateJsonAsset(options: {
  fileName?: string
  rowCount?: number
  includeDuplicates?: boolean
  includeMissingValues?: boolean
  seed?: number
}): Promise<GeneratedAsset> {
  const rows = generateSampleRecords(options)
  const payload = {
    generatedAt: new Date().toISOString(),
    purpose: '1 Hub Apps reusable test asset',
    metadata: {
      rowCount: rows.length,
      containsDuplicates: Boolean(options.includeDuplicates),
      containsMissingValues: Boolean(options.includeMissingValues),
    },
    records: rows,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  return {
    blob,
    fileName: downloadName(options.fileName, 'sample-data', 'json'),
    mimeType: 'application/json',
    assetType: 'json',
    summary: `Nested JSON test dataset containing ${rows.length} structured records.`,
  }
}

export async function generateTextAsset(options: { fileName?: string }): Promise<GeneratedAsset> {
  const text = `UNIVERSAL TEST ASSET FACTORY\n\nOCR & TEXT PROCESSING TEST DOCUMENT\n\nInvoice Reference: INV-017-2026\nCustomer: Aarya Sharma\nDate: 19 July 2026\nAmount: INR 12,450.75\nStatus: PAID\n\nThis paragraph contains mixed punctuation, numbers 1234567890, email test@example.com and URL https://example.com/demo.\n\nDuplicate line test\nDuplicate line test\n\nTable-like content:\nItem | Qty | Price | Total\nKeyboard | 2 | 1499.00 | 2998.00\nMonitor | 1 | 9499.00 | 9499.00\n\nForm fields:\nName: ____________________\nPhone: ___________________\nSignature: _______________\n`
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  return {
    blob,
    fileName: downloadName(options.fileName, 'sample-text', 'txt'),
    mimeType: 'text/plain',
    assetType: 'txt',
    summary: 'Feature-rich TXT with OCR-friendly text, numbers, email, URL, duplicate lines, a table and form-style fields.',
  }
}
