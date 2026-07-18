import type { CompareLine } from '../types'

export function compareText(leftText: string, rightText: string): CompareLine[] {
  const left = leftText.split(/\r?\n/)
  const right = rightText.split(/\r?\n/)
  const max = Math.max(left.length, right.length)
  const rows: CompareLine[] = []

  for (let index = 0; index < max; index += 1) {
    const leftLine = left[index] ?? ''
    const rightLine = right[index] ?? ''
    let kind: CompareLine['kind'] = 'same'
    if (leftLine !== rightLine) {
      if (leftLine && !rightLine) kind = 'removed'
      else if (!leftLine && rightLine) kind = 'added'
      else kind = 'changed'
    }
    rows.push({ kind, left: leftLine, right: rightLine, lineNumber: index + 1 })
  }
  return rows
}
