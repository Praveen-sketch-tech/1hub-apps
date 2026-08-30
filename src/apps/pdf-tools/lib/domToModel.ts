export type Alignment = 'left' | 'center' | 'right' | 'justify'

export interface TextRun {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  fontSize: number
}

export interface Paragraph {
  align: Alignment
  runs: TextRun[]
}

function readAlignment(el: HTMLElement): Alignment {
  const style = (el.style.textAlign || getComputedStyle(el).textAlign || 'left').toLowerCase()
  if (style === 'center') return 'center'
  if (style === 'right') return 'right'
  if (style === 'justify') return 'justify'
  return 'left'
}

/**
 * Walks a paragraph element's DOM and produces text runs with the formatting
 * inherited from ancestor tags/inline styles (bold, italic, underline, size).
 */
function collectRuns(
  node: Node,
  inherited: { bold: boolean; italic: boolean; underline: boolean; fontSize: number },
  out: TextRun[],
) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    if (text) out.push({ text, ...inherited })
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const next = { ...inherited }

  if (tag === 'b' || tag === 'strong' || el.style.fontWeight === 'bold' || Number(el.style.fontWeight) >= 600) next.bold = true
  if (tag === 'i' || tag === 'em' || el.style.fontStyle === 'italic') next.italic = true
  if (tag === 'u' || el.style.textDecoration?.includes('underline')) next.underline = true
  if (el.style.fontSize) {
    const px = parseFloat(el.style.fontSize)
    if (!Number.isNaN(px)) next.fontSize = px
  }

  for (const child of Array.from(el.childNodes)) {
    collectRuns(child, next, out)
  }
}

/**
 * Converts the contentEditable "page" DOM into a structured paragraph model
 * (alignment + formatted text runs) that createPdfDocument can lay out.
 */
export function domToModel(root: HTMLElement, baseFontSize: number): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const blocks = root.children.length > 0 ? Array.from(root.children) : [root]

  for (const block of blocks) {
    const el = block as HTMLElement
    const runs: TextRun[] = []
    collectRuns(el, { bold: false, italic: false, underline: false, fontSize: baseFontSize }, runs)
    // Collapse an all-whitespace/empty paragraph into a blank line rather than dropping it,
    // so intentional blank lines between paragraphs are preserved.
    if (runs.length === 0 || runs.every((r) => !r.text.trim())) {
      paragraphs.push({ align: 'left', runs: [{ text: '', bold: false, italic: false, underline: false, fontSize: baseFontSize }] })
    } else {
      paragraphs.push({ align: readAlignment(el), runs })
    }
  }

  return paragraphs
}
