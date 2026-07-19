import type { VideoEditPlan } from '../types/videoEditPlan'

interface Props {
  plan: VideoEditPlan
  onChange: (plan: VideoEditPlan) => void
}

export function TransformControls({ plan, onChange }: Props) {
  const first = plan.clips[0]
  const setSize = (width: number, height: number, aspectRatio: VideoEditPlan['output']['aspectRatio']) => {
    onChange({ ...plan, output: { ...plan.output, width, height, aspectRatio } })
  }

  return (
    <div className="bvps-control-grid">
      <label>
        Output preset
        <select
          value={plan.output.aspectRatio ?? 'original'}
          onChange={(event) => {
            const value = event.target.value
            if (value === '16:9') setSize(1280, 720, '16:9')
            else if (value === '9:16') setSize(720, 1280, '9:16')
            else if (value === '1:1') setSize(1080, 1080, '1:1')
            else onChange({ ...plan, output: { ...plan.output, aspectRatio: 'original' } })
          }}
        >
          <option value="original">Original</option>
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
          <option value="1:1">1:1</option>
        </select>
      </label>
      <label>
        Width
        <input type="number" min={160} max={3840} value={plan.output.width} onChange={(event) => onChange({ ...plan, output: { ...plan.output, width: Number(event.target.value) || 1280 } })} />
      </label>
      <label>
        Height
        <input type="number" min={160} max={3840} value={plan.output.height} onChange={(event) => onChange({ ...plan, output: { ...plan.output, height: Number(event.target.value) || 720 } })} />
      </label>
      <label>
        Rotation
        <select
          value={first.transform?.rotation ?? 0}
          onChange={(event) => {
            const rotation = Number(event.target.value) as 0 | 90 | 180 | 270
            onChange({ ...plan, clips: plan.clips.map((clip) => ({ ...clip, transform: { ...clip.transform, rotation } })) })
          }}
        >
          <option value={0}>0°</option>
          <option value={90}>90°</option>
          <option value={180}>180°</option>
          <option value={270}>270°</option>
        </select>
      </label>
      <label>
        Fit
        <select
          value={first.transform?.fit ?? 'contain'}
          onChange={(event) => {
            const fit = event.target.value as 'contain' | 'cover' | 'stretch'
            onChange({ ...plan, clips: plan.clips.map((clip) => ({ ...clip, transform: { ...clip.transform, fit } })) })
          }}
        >
          <option value="contain">Contain / padding</option>
          <option value="cover">Cover / crop</option>
          <option value="stretch">Stretch</option>
        </select>
      </label>
      <label>
        Background
        <input type="color" value={first.transform?.background ?? '#000000'} onChange={(event) => onChange({ ...plan, clips: plan.clips.map((clip) => ({ ...clip, transform: { ...clip.transform, background: event.target.value } })) })} />
      </label>
    </div>
  )
}
