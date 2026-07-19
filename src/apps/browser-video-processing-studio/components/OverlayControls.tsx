import { useState } from 'react'
import type { VideoEditPlan } from '../types/videoEditPlan'

interface Props {
  plan: VideoEditPlan
  onChange: (plan: VideoEditPlan) => void
}

export function OverlayControls({ plan, onChange }: Props) {
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')

  return (
    <div className="bvps-stack">
      <div className="bvps-control-grid">
        <label>
          Intro title
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Product demo" />
        </label>
        <button
          type="button"
          onClick={() => {
            if (!title.trim()) return
            onChange({ ...plan, overlays: [...plan.overlays, { type: 'title', start: 0, end: 2, text: title.trim() }] })
          }}
        >Add 0–2s title</button>
      </div>
      <div className="bvps-control-grid">
        <label>
          Step caption
          <input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Upload a sample file" />
        </label>
        <button
          type="button"
          onClick={() => {
            if (!caption.trim()) return
            onChange({ ...plan, overlays: [...plan.overlays, { type: 'caption', start: 2, end: 5, text: caption.trim(), position: 'bottom' }] })
          }}
        >Add 2–5s caption</button>
      </div>
      <small>{plan.overlays.length} overlay(s) configured. Structured cursor/click/highlight/zoom events are supported by the engine API for future orchestrators.</small>
    </div>
  )
}
