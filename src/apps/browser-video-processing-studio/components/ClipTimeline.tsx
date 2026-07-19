import type { VideoClip } from '../types/videoEditPlan'

interface Props {
  clips: VideoClip[]
  onChange: (clips: VideoClip[]) => void
}

export function ClipTimeline({ clips, onChange }: Props) {
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= clips.length) return
    const next = [...clips]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="bvps-timeline-list">
      {clips.map((clip, index) => (
        <div className="bvps-clip" key={clip.id}>
          <div>
            <strong>Clip {index + 1}</strong>
            <span>{clip.sourceStart.toFixed(1)}s → {clip.sourceEnd.toFixed(1)}s</span>
          </div>
          <div className="bvps-inline-actions">
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0}>↑</button>
            <button type="button" onClick={() => move(index, 1)} disabled={index === clips.length - 1}>↓</button>
            <button type="button" onClick={() => onChange(clips.filter((item) => item.id !== clip.id))} disabled={clips.length === 1}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  )
}
