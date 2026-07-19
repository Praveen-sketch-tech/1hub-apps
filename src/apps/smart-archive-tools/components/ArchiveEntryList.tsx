import type { ArchiveEntry } from '../lib/archive'
import { formatBytes } from '../lib/archive'

type Props = {
  entries: ArchiveEntry[]
  selected: Set<string>
  onToggle: (path: string) => void
}

export function ArchiveEntryList({ entries, selected, onToggle }: Props) {
  if (!entries.length) {
    return <p className="sat-muted">This archive is empty.</p>
  }

  return (
    <div className="sat-entry-list" role="list">
      {entries.map((entry) => (
        <label className="sat-entry" key={entry.path}>
          <input
            type="checkbox"
            disabled={entry.isDirectory}
            checked={!entry.isDirectory && selected.has(entry.path)}
            onChange={() => onToggle(entry.path)}
            aria-label={`Select ${entry.path}`}
          />
          <span className="sat-entry-icon" aria-hidden="true">{entry.isDirectory ? '📁' : '📄'}</span>
          <span className="sat-entry-main">
            <span className="sat-entry-path">{entry.path}</span>
            <span className="sat-muted">{entry.isDirectory ? 'Folder' : formatBytes(entry.size)}</span>
          </span>
        </label>
      ))}
    </div>
  )
}
