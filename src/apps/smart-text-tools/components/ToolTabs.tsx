import type { TextTool } from '../types'

const tools: Array<{ value: TextTool; label: string }> = [
  { value: 'clean', label: 'Clean' },
  { value: 'case', label: 'Case' },
  { value: 'duplicates', label: 'Duplicates' },
  { value: 'sort', label: 'Sort' },
  { value: 'find-replace', label: 'Find & Replace' },
  { value: 'prefix-suffix', label: 'Prefix / Suffix' },
  { value: 'extract', label: 'Extract' },
  { value: 'compare', label: 'Compare' },
  { value: 'json', label: 'JSON' },
  { value: 'encode', label: 'Encode / Decode' },
]

export default function ToolTabs({
  value,
  onChange,
}: {
  value: TextTool
  onChange: (tool: TextTool) => void
}) {
  return (
    <div className="stt-tabs" role="tablist" aria-label="Text tools">
      {tools.map((tool) => (
        <button
          key={tool.value}
          type="button"
          role="tab"
          aria-selected={value === tool.value}
          className={value === tool.value ? 'is-active' : ''}
          onClick={() => onChange(tool.value)}
        >
          {tool.label}
        </button>
      ))}
    </div>
  )
}
