import { useMemo, useState } from 'react'
import { compareText } from '../lib/compare'

export default function ComparePanel() {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const rows = useMemo(() => compareText(left, right), [left, right])
  const changed = rows.filter((row) => row.kind !== 'same').length

  return (
    <div className="stt-compare">
      <div className="stt-compare-inputs">
        <label>Original text<textarea value={left} onChange={(e) => setLeft(e.target.value)} rows={12} /></label>
        <label>New text<textarea value={right} onChange={(e) => setRight(e.target.value)} rows={12} /></label>
      </div>
      <div className="stt-compare-summary">
        {changed} changed line{changed === 1 ? '' : 's'}
      </div>
      <div className="stt-diff">
        {rows.map((row) => (
          <div className={`stt-diff-row is-${row.kind}`} key={row.lineNumber}>
            <span className="stt-line-number">{row.lineNumber}</span>
            <code>{row.left || ' '}</code>
            <code>{row.right || ' '}</code>
          </div>
        ))}
      </div>
    </div>
  )
}
