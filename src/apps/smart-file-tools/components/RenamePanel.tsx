import type { RenameRules } from '../lib/types'

interface Props {
  rules: RenameRules
  setRules: (rules: RenameRules) => void
}

export default function RenamePanel({ rules, setRules }: Props) {
  const patch = <K extends keyof RenameRules>(key: K, value: RenameRules[K]) =>
    setRules({ ...rules, [key]: value })

  return (
    <section className="sft-card">
      <h3>Bulk rename</h3>
      <div className="sft-grid">
        <label>Prefix<input value={rules.prefix} onChange={(e) => patch('prefix', e.target.value)} /></label>
        <label>Suffix<input value={rules.suffix} onChange={(e) => patch('suffix', e.target.value)} /></label>
        <label>Find<input value={rules.find} onChange={(e) => patch('find', e.target.value)} /></label>
        <label>Replace<input value={rules.replace} onChange={(e) => patch('replace', e.target.value)} /></label>
        <label className="sft-check"><input type="checkbox" checked={rules.useRegex} onChange={(e) => patch('useRegex', e.target.checked)} /> Regex find</label>
        <label className="sft-check"><input type="checkbox" checked={rules.addSequence} onChange={(e) => patch('addSequence', e.target.checked)} /> Sequential numbering</label>
        <label>Start<input type="number" value={rules.startNumber} onChange={(e) => patch('startNumber', Number(e.target.value) || 1)} /></label>
        <label>Padding<input type="number" min={1} max={8} value={rules.pad} onChange={(e) => patch('pad', Math.max(1, Math.min(8, Number(e.target.value) || 1)))} /></label>
      </div>
    </section>
  )
}
