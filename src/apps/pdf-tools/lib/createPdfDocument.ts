import 'regenerator-runtime/runtime'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { splitByScript, type Script } from './textSegmentation'
import type { Paragraph, TextRun } from './domToModel'

const PAGE_WIDTH = 595.28 // A4
const PAGE_HEIGHT = 841.89
const MARGIN = 56
const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2

interface Token {
  text: string
  script: Script
  bold: boolean
  italic: boolean
  underline: boolean
  fontSize: number
  isSpace: boolean
}

interface Fonts {
  latinRegular: PDFFont
  latinBold: PDFFont
  latinItalic: PDFFont
  latinBoldItalic: PDFFont
  devanagariRegular: PDFFont
  devanagariBold: PDFFont
}

function pickFont(fonts: Fonts, script: Script, bold: boolean, italic: boolean): PDFFont {
  if (script === 'devanagari') {
    // No italic variant available for the embedded Devanagari font — falls
    // back to regular/bold rather than faking a slant. Documented in the UI.
    return bold ? fonts.devanagariBold : fonts.devanagariRegular
  }
  if (bold && italic) return fonts.latinBoldItalic
  if (bold) return fonts.latinBold
  if (italic) return fonts.latinItalic
  return fonts.latinRegular
}

function tokenize(run: TextRun): Token[] {
  const tokens: Token[] = []
  const words = run.text.split(/(\s+)/).filter((w) => w.length > 0)
  for (const word of words) {
    const isSpace = /^\s+$/.test(word)
    if (isSpace) {
      tokens.push({ text: word, script: 'latin', bold: run.bold, italic: run.italic, underline: run.underline, fontSize: run.fontSize, isSpace: true })
      continue
    }
    for (const scriptRun of splitByScript(word)) {
      tokens.push({
        text: scriptRun.text,
        script: scriptRun.script,
        bold: run.bold,
        italic: run.italic,
        underline: run.underline,
        fontSize: run.fontSize,
        isSpace: false,
      })
    }
  }
  return tokens
}

async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit)
  const [devRegularBytes, devBoldBytes] = await Promise.all([
    fetch('/fonts/noto-sans-devanagari-regular.ttf').then((r) => r.arrayBuffer()),
    fetch('/fonts/noto-sans-devanagari-bold.ttf').then((r) => r.arrayBuffer()),
  ])

  return {
    latinRegular: await doc.embedFont(StandardFonts.Helvetica),
    latinBold: await doc.embedFont(StandardFonts.HelveticaBold),
    latinItalic: await doc.embedFont(StandardFonts.HelveticaOblique),
    latinBoldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    devanagariRegular: await doc.embedFont(devRegularBytes, { subset: true }),
    devanagariBold: await doc.embedFont(devBoldBytes, { subset: true }),
  }
}

export async function createPdfDocument(paragraphs: Paragraph[]): Promise<Blob> {
  const doc = await PDFDocument.create()
  const fonts = await loadFonts(doc)
  const dark = rgb(0.1, 0.1, 0.12)

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  function newPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
  }

  for (const paragraph of paragraphs) {
    const tokens = paragraph.runs.flatMap(tokenize)

    if (tokens.length === 0 || tokens.every((t) => t.isSpace)) {
      y -= 16
      if (y < MARGIN) newPage()
      continue
    }

    const lines: Token[][] = []
    let current: Token[] = []
    let currentWidth = 0

    for (const token of tokens) {
      const font = pickFont(fonts, token.script, token.bold, token.italic)
      const width = font.widthOfTextAtSize(token.text, token.fontSize)

      if (currentWidth + width > MAX_WIDTH && current.length > 0 && !token.isSpace) {
        lines.push(current)
        current = []
        currentWidth = 0
      }
      current.push(token)
      currentWidth += width
    }
    if (current.length > 0) lines.push(current)

    for (const line of lines) {
      const trimmedLine = [...line]
      if (trimmedLine.length > 0 && trimmedLine[trimmedLine.length - 1].isSpace) trimmedLine.pop()

      const widths = trimmedLine.map((t) => pickFont(fonts, t.script, t.bold, t.italic).widthOfTextAtSize(t.text, t.fontSize))
      const lineWidth = widths.reduce((a, b) => a + b, 0)
      const maxFontSize = Math.max(...trimmedLine.map((t) => t.fontSize), 12)
      const lineHeight = maxFontSize * 1.4

      if (y - lineHeight < MARGIN) newPage()

      let x = MARGIN
      if (paragraph.align === 'center') x = MARGIN + (MAX_WIDTH - lineWidth) / 2
      else if (paragraph.align === 'right') x = MARGIN + (MAX_WIDTH - lineWidth)

      const spaceCount = trimmedLine.filter((t) => t.isSpace).length
      const extraPerSpace = paragraph.align === 'justify' && spaceCount > 0 ? (MAX_WIDTH - lineWidth) / spaceCount : 0

      for (let i = 0; i < trimmedLine.length; i++) {
        const token = trimmedLine[i]
        const font = pickFont(fonts, token.script, token.bold, token.italic)
        const width = widths[i]

        if (!token.isSpace) {
          page.drawText(token.text, { x, y, size: token.fontSize, font, color: dark })
          if (token.underline) {
            page.drawLine({ start: { x, y: y - 2 }, end: { x: x + width, y: y - 2 }, thickness: 0.75, color: dark })
          }
        }

        x += width + (token.isSpace ? extraPerSpace : 0)
      }

      y -= lineHeight
    }

    y -= 6
  }

  const bytes = await doc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}
