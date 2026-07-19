import { useMemo, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { generateUuids } from './lib/uuid'
import './smart-uuid-generator.css'

export default function SmartUuidGeneratorPage() {
  const [count, setCount] = useState(1)
  const [uuids, setUuids] = useState<string[]>(() => generateUuids(1))
  const output = useMemo(() => uuids.join('\n'), [uuids])

  const generate = () => {
    const safeCount = Math.max(1, Math.min(100, Number(count) || 1))
    setCount(safeCount)
    setUuids(generateUuids(safeCount))
  }

  const copyAll = async () => {
    await navigator.clipboard.writeText(output)
  }

  const download = () => {
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = uuids.length === 1 ? 'uuid.txt' : `${uuids.length}-uuids.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="uuid-app">
      <ToolAppHeader
        appNumber="012"
        title="Smart UUID Generator"
        description="Generate secure UUID v4 identifiers locally in your browser."
      />

      <div className="uuid-local-badge">
</div>

      <section className="uuid-panel">
        <label className="uuid-label" htmlFor="uuid-count">
          Number of UUIDs (1–100)
        </label>
        <input
          id="uuid-count"
          className="uuid-input"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
        />

        <div className="uuid-actions">
          <button type="button" onClick={generate}>Generate UUIDs</button>
          <button type="button" onClick={copyAll}>Copy all</button>
          <button type="button" onClick={download}>Download TXT</button>
        </div>

        <div className="uuid-results">
          {uuids.map((uuid) => (
            <div className="uuid-row" key={uuid}>
              <code>{uuid}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(uuid)}
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
