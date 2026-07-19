import { useEffect, useMemo, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { VideoDropzone } from './components/VideoDropzone'
import { VideoPreview } from './components/VideoPreview'
import { ClipTimeline } from './components/ClipTimeline'
import { TransformControls } from './components/TransformControls'
import { OverlayControls } from './components/OverlayControls'
import { ExportControls } from './components/ExportControls'
import { detectVideoProcessingCapabilities } from './lib/capabilityDetection'
import { processEditPlan } from './lib/editPlanProcessor'
import { inspectVideo } from './lib/inspectVideo'
import { createDefaultEditPlan, createSource, getPlanDuration } from './lib/videoProcessing'
import type { VideoEditPlan, VideoMetadata } from './types/videoEditPlan'
import './BrowserVideoProcessingStudio.css'

export function BrowserVideoProcessingStudioPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [plan, setPlan] = useState<VideoEditPlan | null>(null)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [splitAt, setSplitAt] = useState(0)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const capabilities = useMemo(() => detectVideoProcessingCapabilities(), [])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const loadFile = async (nextFile: File) => {
    if (!nextFile.type.startsWith('video/') && !/\.webm$/i.test(nextFile.name)) {
      setStatus('Please choose a video file supported by your browser.')
      return
    }
    setBusy(true)
    setStatus('Inspecting video…')
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const info = await inspectVideo(nextFile)
      const source = createSource(nextFile)
      setFile(nextFile)
      setPreviewUrl(URL.createObjectURL(nextFile))
      setMetadata(info)
      setTrimStart(0)
      setTrimEnd(info.duration)
      setSplitAt(Math.min(info.duration / 2, info.duration))
      setPlan(createDefaultEditPlan(source, info.duration, info.width, info.height))
      setStatus('Video ready for local editing.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to inspect this video.')
    } finally {
      setBusy(false)
    }
  }

  const applyTrim = () => {
    if (!plan || !plan.clips[0]) return
    const start = Math.max(0, Math.min(trimStart, trimEnd))
    const end = Math.min(metadata?.duration ?? trimEnd, Math.max(trimStart, trimEnd))
    setPlan({ ...plan, clips: [{ ...plan.clips[0], sourceStart: start, sourceEnd: end }] })
  }

  const splitClip = () => {
    if (!plan || !plan.clips[0]) return
    const clip = plan.clips[0]
    if (splitAt <= clip.sourceStart || splitAt >= clip.sourceEnd) {
      setStatus('Split time must be inside the current clip range.')
      return
    }
    setPlan({
      ...plan,
      clips: [
        { ...clip, id: crypto.randomUUID(), sourceEnd: splitAt },
        { ...clip, id: crypto.randomUUID(), sourceStart: splitAt },
      ],
    })
  }

  const exportNow = async () => {
    if (!plan) return
    setBusy(true)
    setStatus('Rendering locally in your browser. Keep this tab active for best results…')
    try {
      const result = await processEditPlan(plan)
      const url = URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setStatus(`Exported ${result.width}×${result.height} ${result.mimeType}. Audio preservation depends on browser support; mute/video-only processing is reliable.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Video export failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bvps-page">
      <ToolAppHeader
        appNumber="019"
        title="Browser Video Processing Studio"
        description="Edit, process and polish videos locally in your browser with reusable demo-video processing tools."
      />

      <div className="bvps-layout">
        <section className="bvps-card">
          <h2>Import video</h2>
          <VideoDropzone onFile={(next) => void loadFile(next)} />
          <div className="bvps-capabilities">
            <span>MediaRecorder: {capabilities.mediaRecorder ? 'Supported' : 'Unavailable'}</span>
            <span>Canvas export: {capabilities.canvasCaptureStream ? 'Supported' : 'Unavailable'}</span>
            <span>WebCodecs: {capabilities.webCodecs ? 'Available (optional)' : 'Unavailable'}</span>
          </div>
        </section>

        {file && metadata && plan && (
          <>
            <section className="bvps-card bvps-preview-card">
              <h2>Preview</h2>
              <VideoPreview src={previewUrl} />
              <div className="bvps-meta-grid">
                <span><strong>Name</strong>{metadata.name}</span>
                <span><strong>Duration</strong>{metadata.duration.toFixed(2)}s</span>
                <span><strong>Dimensions</strong>{metadata.width}×{metadata.height}</span>
                <span><strong>MIME</strong>{metadata.mimeType || 'Unknown'}</span>
                <span><strong>Size</strong>{(metadata.size / 1024 / 1024).toFixed(2)} MB</span>
                <span><strong>Edited duration</strong>{getPlanDuration(plan).toFixed(2)}s</span>
              </div>
            </section>

            <section className="bvps-card">
              <h2>Trim & split</h2>
              <div className="bvps-control-grid">
                <label>Trim start (s)<input type="number" min={0} max={metadata.duration} step="0.1" value={trimStart} onChange={(event) => setTrimStart(Number(event.target.value))} /></label>
                <label>Trim end (s)<input type="number" min={0} max={metadata.duration} step="0.1" value={trimEnd} onChange={(event) => setTrimEnd(Number(event.target.value))} /></label>
                <button type="button" onClick={applyTrim}>Apply trim</button>
                <label>Split at (s)<input type="number" min={0} max={metadata.duration} step="0.1" value={splitAt} onChange={(event) => setSplitAt(Number(event.target.value))} /></label>
                <button type="button" onClick={splitClip}>Split current clip</button>
              </div>
              <ClipTimeline clips={plan.clips} onChange={(clips) => setPlan({ ...plan, clips })} />
            </section>

            <section className="bvps-card">
              <h2>Visual processing</h2>
              <TransformControls plan={plan} onChange={setPlan} />
              <p className="bvps-note">Crop, normalized focus regions, cursor events, click indicators and zoom events are supported by the reusable edit-plan engine. The current standalone UI exposes the most reliable basic controls first.</p>
            </section>

            <section className="bvps-card">
              <h2>Demo enhancements</h2>
              <OverlayControls plan={plan} onChange={setPlan} />
            </section>

            <section className="bvps-card">
              <h2>Export</h2>
              <ExportControls plan={plan} busy={busy} onChange={setPlan} onExport={() => void exportNow()} />
              <p className="bvps-note">Primary V1 export is browser-supported WebM. MP4 output is not falsely promised when the current browser cannot encode it.</p>
            </section>
          </>
        )}

        {status && <div className="bvps-status" role="status">{status}</div>}
      </div>
    </div>
  )
}
