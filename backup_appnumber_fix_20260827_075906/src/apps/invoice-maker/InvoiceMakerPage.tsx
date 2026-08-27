import { useState } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'

interface LineItem {
  id: string
  description: string
  qty: number
  rate: number
}

const GST_OPTIONS = [0, 5, 12, 18, 28]

function newItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', qty: 1, rate: 0 }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function nextInvoiceNumber() {
  try {
    const last = localStorage.getItem('invoice-maker:last-number')
    const n = last ? parseInt(last, 10) + 1 : 1
    return `INV-${String(n).padStart(4, '0')}`
  } catch {
    return `INV-0001`
  }
}

function saveInvoiceNumber(invoiceNumber: string) {
  const match = invoiceNumber.match(/(\d+)$/)
  if (match) {
    try {
      localStorage.setItem('invoice-maker:last-number', match[1])
    } catch {
      // localStorage unavailable — non-critical, just skip persisting.
    }
  }
}

/**
 * Reusable PDF-building function — kept outside the component so a future
 * chat action could call it with the same data shape.
 */
async function generateInvoicePdf(data: {
  businessName: string
  businessAddress: string
  businessPhone: string
  businessGSTIN: string
  customerName: string
  customerAddress: string
  invoiceNumber: string
  invoiceDate: string
  items: LineItem[]
  gstPercent: number
  discountPercent: number
  notes: string
}): Promise<Blob> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89]) // A4
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const margin = 48
  let y = 841.89 - margin
  const dark = rgb(0.12, 0.14, 0.18)
  const gray = rgb(0.45, 0.47, 0.5)
  const line = rgb(0.85, 0.86, 0.88)

  function text(str: string, x: number, yy: number, opts: { size?: number; f?: typeof font; color?: typeof dark } = {}) {
    page.drawText(str, { x, y: yy, size: opts.size ?? 10, font: opts.f ?? font, color: opts.color ?? dark })
  }

  // Header
  text(data.businessName || 'Your Business Name', margin, y, { size: 18, f: bold })
  y -= 20
  if (data.businessAddress) { text(data.businessAddress, margin, y, { size: 9, color: gray }); y -= 13 }
  if (data.businessPhone) { text(`Phone: ${data.businessPhone}`, margin, y, { size: 9, color: gray }); y -= 13 }
  if (data.businessGSTIN) { text(`GSTIN: ${data.businessGSTIN}`, margin, y, { size: 9, color: gray }); y -= 13 }

  // Invoice title top-right
  text('INVOICE', 595.28 - margin - 90, 841.89 - margin, { size: 18, f: bold })
  text(`# ${data.invoiceNumber}`, 595.28 - margin - 90, 841.89 - margin - 20, { size: 10, color: gray })
  text(`Date: ${data.invoiceDate}`, 595.28 - margin - 90, 841.89 - margin - 34, { size: 10, color: gray })

  y -= 20
  page.drawLine({ start: { x: margin, y }, end: { x: 595.28 - margin, y }, thickness: 1, color: line })
  y -= 24

  // Bill To
  text('BILL TO', margin, y, { size: 9, f: bold, color: gray })
  y -= 15
  text(data.customerName || 'Customer name', margin, y, { size: 12, f: bold })
  y -= 15
  if (data.customerAddress) {
    for (const l of data.customerAddress.split('\n')) {
      text(l, margin, y, { size: 9, color: gray })
      y -= 12
    }
  }

  y -= 20

  // Table header
  const col = { desc: margin, qty: 330, rate: 400, amount: 480 }
  text('DESCRIPTION', col.desc, y, { size: 9, f: bold, color: gray })
  text('QTY', col.qty, y, { size: 9, f: bold, color: gray })
  text('RATE', col.rate, y, { size: 9, f: bold, color: gray })
  text('AMOUNT', col.amount, y, { size: 9, f: bold, color: gray })
  y -= 8
  page.drawLine({ start: { x: margin, y }, end: { x: 595.28 - margin, y }, thickness: 1, color: line })
  y -= 18

  let subtotal = 0
  for (const item of data.items) {
    if (!item.description && item.qty === 0 && item.rate === 0) continue
    const amount = item.qty * item.rate
    subtotal += amount
    text(item.description || '-', col.desc, y, { size: 10 })
    text(String(item.qty), col.qty, y, { size: 10 })
    text(`Rs. ${item.rate.toFixed(2)}`, col.rate, y, { size: 10 })
    text(`Rs. ${amount.toFixed(2)}`, col.amount, y, { size: 10 })
    y -= 18
    if (y < 150) break // guard against overflow in this v1 (single-page invoices)
  }

  y -= 10
  page.drawLine({ start: { x: 330, y }, end: { x: 595.28 - margin, y }, thickness: 1, color: line })
  y -= 20

  const discountAmount = subtotal * (data.discountPercent / 100)
  const taxable = subtotal - discountAmount
  const gstAmount = taxable * (data.gstPercent / 100)
  const total = taxable + gstAmount

  function totalsRow(label: string, value: string, boldRow = false) {
    text(label, 400, y, { size: 10, f: boldRow ? bold : font, color: boldRow ? dark : gray })
    text(value, col.amount, y, { size: 10, f: boldRow ? bold : font })
    y -= 16
  }

  totalsRow('Subtotal', `Rs. ${subtotal.toFixed(2)}`)
  if (data.discountPercent > 0) totalsRow(`Discount (${data.discountPercent}%)`, `- Rs. ${discountAmount.toFixed(2)}`)
  if (data.gstPercent > 0) totalsRow(`GST (${data.gstPercent}%)`, `Rs. ${gstAmount.toFixed(2)}`)
  y -= 4
  page.drawLine({ start: { x: 330, y }, end: { x: 595.28 - margin, y }, thickness: 1, color: line })
  y -= 20
  totalsRow('Total', `Rs. ${total.toFixed(2)}`, true)

  if (data.notes) {
    y -= 30
    text('NOTES', margin, y, { size: 9, f: bold, color: gray })
    y -= 15
    for (const l of data.notes.split('\n')) {
      text(l, margin, y, { size: 9, color: gray })
      y -= 12
    }
  }

  const bytes = await doc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

export function InvoiceMakerPage() {
  const [businessName, setBusinessName] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessGSTIN, setBusinessGSTIN] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState(nextInvoiceNumber)
  const [invoiceDate, setInvoiceDate] = useState(todayISO)
  const [items, setItems] = useState<LineItem[]>([newItem()])
  const [gstPercent, setGstPercent] = useState(18)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }
  function addItem() {
    setItems((prev) => [...prev, newItem()])
  }
  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev))
  }

  const subtotal = items.reduce((sum, it) => sum + it.qty * it.rate, 0)
  const discountAmount = subtotal * (discountPercent / 100)
  const gstAmount = (subtotal - discountAmount) * (gstPercent / 100)
  const total = subtotal - discountAmount + gstAmount

  async function handleGenerate() {
    if (!customerName.trim()) {
      setError('Customer name daalna zaroori hai.')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const blob = await generateInvoicePdf({
        businessName, businessAddress, businessPhone, businessGSTIN,
        customerName, customerAddress, invoiceNumber, invoiceDate,
        items, gstPercent, discountPercent, notes,
      })
      setResultUrl(URL.createObjectURL(blob))
      saveInvoiceNumber(invoiceNumber)
    } catch {
      setError('Invoice banane mein kuch dikkat aayi, dobara try karo.')
    } finally {
      setGenerating(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-800'
  const labelCls = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400'

  return (
    <PageContainer>
      <div className="tool-page">
        <ToolAppHeader
          appNumber="XX"
          title="Invoice Maker"
          description="Business details bharo, items add karo — GST-ready professional invoice PDF turant download karo. Sab kuch browser mein hota hai, koi login nahi chahiye."
        />

        <Card>
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold">Your business</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Business name</label>
                  <input className={inputCls} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Sharma Traders" />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls} value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} placeholder="+91 98xxxxxxx" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Address</label>
                  <input className={inputCls} value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="Shop no, Street, City" />
                </div>
                <div>
                  <label className={labelCls}>GSTIN (optional)</label>
                  <input className={inputCls} value={businessGSTIN} onChange={(e) => setBusinessGSTIN(e.target.value)} placeholder="22AAAAA0000A1Z5" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Bill to</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Customer name *</label>
                  <input className={inputCls} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer / company name" />
                </div>
                <div>
                  <label className={labelCls}>Customer address</label>
                  <input className={inputCls} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Optional" />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Invoice number</label>
                <input className={inputCls} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" className={inputCls} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Items</h3>
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 items-center gap-2">
                    <input
                      className={`${inputCls} col-span-6`}
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    />
                    <input
                      className={`${inputCls} col-span-2`}
                      type="number"
                      min={0}
                      placeholder="Qty"
                      value={item.qty}
                      onChange={(e) => updateItem(item.id, { qty: Number(e.target.value) })}
                    />
                    <input
                      className={`${inputCls} col-span-3`}
                      type="number"
                      min={0}
                      placeholder="Rate"
                      value={item.rate}
                      onChange={(e) => updateItem(item.id, { rate: Number(e.target.value) })}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="col-span-1 text-sm text-red-500 hover:text-red-700"
                      aria-label="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem} className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                + Add item
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>GST %</label>
                <select className={inputCls} value={gstPercent} onChange={(e) => setGstPercent(Number(e.target.value))}>
                  {GST_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}%</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Discount %</label>
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes (optional)</label>
              <textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, bank details, thank-you note…" />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>Rs. {subtotal.toFixed(2)}</span></div>
              {discountPercent > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">Discount ({discountPercent}%)</span><span>- Rs. {discountAmount.toFixed(2)}</span></div>
              )}
              {gstPercent > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">GST ({gstPercent}%)</span><span>Rs. {gstAmount.toFixed(2)}</span></div>
              )}
              <div className="mt-2 flex justify-between border-t border-slate-300 pt-2 text-base font-semibold dark:border-slate-600">
                <span>Total</span><span>Rs. {total.toFixed(2)}</span>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating…' : 'Generate invoice PDF'}
            </Button>

            {resultUrl && (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <p className="text-sm font-medium">Invoice ready!</p>
                <a href={resultUrl} download={`${invoiceNumber || 'invoice'}.pdf`}>
                  <Button>Download PDF</Button>
                </a>
              </div>
            )}
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}
