import type { TextStats } from '../types'

export default function TextStatsBar({ stats }: { stats: TextStats }) {
  const items = [
    ['Characters', stats.characters],
    ['No spaces', stats.charactersNoSpaces],
    ['Words', stats.words],
    ['Lines', stats.lines],
    ['Sentences', stats.sentences],
    ['Bytes', stats.bytes],
  ]

  return (
    <div className="stt-stats" aria-label="Text statistics">
      {items.map(([label, value]) => (
        <div key={String(label)}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}
