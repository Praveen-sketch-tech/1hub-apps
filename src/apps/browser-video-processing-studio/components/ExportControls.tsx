import type { VideoEditPlan } from '../types/videoEditPlan'

interface Props {
  plan: VideoEditPlan
  busy: boolean
  onChange: (plan: VideoEditPlan) => void
  onExport: () => void
}

export function ExportControls({ plan, busy, onChange, onExport }: Props) {
  return (
    <div className="bvps-export-row">
      <label className="bvps-check">
        <input
          type="checkbox"
          checked={plan.audio.muted}
          onChange={(event) => onChange({ ...plan, audio: { ...plan.audio, muted: event.target.checked, volume: event.target.checked ? 0 : 1 } })}
        />
        Mute output
      </label>
      <button className="bvps-primary" type="button" disabled={busy} onClick={onExport}>
        {busy ? 'Processing…' : 'Export processed WebM'}
      </button>
    </div>
  )
}
