import { useEffect, useMemo, useRef, useState } from 'react'
import VideoDropzone from './components/VideoDropzone'
import { extractAudio, processVideo } from './lib/ffmpegProcessor'
import { trackVideoToolEvent } from './lib/analytics'
import type { ProcessingProgress, VideoSettings } from './types'
import './smart-video-tools.css'

const DEFAULT_SETTINGS: VideoSettings = {
  startTime: 0,
  endTime: 0,
  rotate: 0,
  scalePercent: 100,
  muted: false,
  speed: 1,
  crf: 28,
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function SmartVideoToolsPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [duration, setDuration] = useState(0)
  const [settings, setSettings] = useState<VideoSettings>(DEFAULT_SETTINGS)
  const [progress, setProgress] = useState<ProcessingProgress | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    }
  }, [sourceUrl])

  const trimLength = useMemo(
    () => Math.max(0, settings.endTime - settings.startTime),
    [settings.endTime, settings.startTime],
  )

  const handleFile = (nextFile: File) => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    const url = URL.createObjectURL(nextFile)
    setFile(nextFile)
    setSourceUrl(url)
    setDuration(0)
    setSettings(DEFAULT_SETTINGS)
    setProgress(null)
    setError('')
    trackVideoToolEvent('video_uploaded')
  }

  const onLoadedMetadata = () => {
    const value = videoRef.current?.duration ?? 0
    if (!Number.isFinite(value) || value <= 0) return
    setDuration(value)
    setSettings((current) => ({ ...current, startTime: 0, endTime: value }))
  }

  const runProcess = async () => {
    if (!file) return
    if (settings.endTime <= settings.startTime) {
      setError('End time must be greater than start time.')
      return
    }

    setProcessing(true)
    setError('')
    setProgress({ ratio: 0, message: 'Preparing…' })

    try {
      const blob = await processVideo(file, settings, setProgress)
      downloadBlob(blob, 'processed-video.mp4')
      trackVideoToolEvent('video_exported', {
        muted: settings.muted,
        rotated: settings.rotate !== 0,
        resized: settings.scalePercent !== 100,
        compressed: settings.crf !== 28,
      })
    } catch (err) {
      console.error(err)
      setError('Video processing failed. Try a shorter/smaller video or another browser.')
    } finally {
      setProcessing(false)
    }
  }

  const runExtractAudio = async () => {
    if (!file) return
    setProcessing(true)
    setError('')
    setProgress({ ratio: 0, message: 'Preparing audio extraction…' })

    try {
      const blob = await extractAudio(file, settings.startTime, settings.endTime, setProgress)
      downloadBlob(blob, 'extracted-audio.mp3')
      trackVideoToolEvent('audio_extracted')
    } catch (err) {
      console.error(err)
      setError('Audio extraction failed for this video.')
    } finally {
      setProcessing(false)
    }
  }

  const reset = () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    setFile(null)
    setSourceUrl('')
    setDuration(0)
    setSettings(DEFAULT_SETTINGS)
    setProgress(null)
    setError('')
  }

  return (
    <main className="svt-page">
      <section className="svt-hero">
        <div>
          <div className="svt-kicker">APP #010</div>
          <h1>Smart Video Tools</h1>
          <p>Trim, resize, rotate, mute, compress and extract audio directly in your browser.</p>
        </div>
        <div className="local-processing-badge">🔒 Local processing</div>
      </section>

      {!file ? (
        <VideoDropzone onFile={handleFile} />
      ) : (
        <>
          <section className="svt-card svt-preview-card">
            <div className="svt-row-between">
              <div className="svt-file-meta">
                <strong>{file.name}</strong>
                <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              <button type="button" onClick={reset} disabled={processing}>Choose another</button>
            </div>

            <video
              ref={videoRef}
              className="svt-video"
              src={sourceUrl}
              controls
              playsInline
              onLoadedMetadata={onLoadedMetadata}
            />
          </section>

          <section className="svt-card">
            <h2>Trim</h2>
            <div className="svt-grid">
              <label>
                Start time (seconds)
                <input
                  type="number"
                  min={0}
                  max={duration}
                  step="0.1"
                  value={settings.startTime}
                  onChange={(e) => setSettings((s) => ({ ...s, startTime: Number(e.target.value) }))}
                />
              </label>
              <label>
                End time (seconds)
                <input
                  type="number"
                  min={0}
                  max={duration}
                  step="0.1"
                  value={settings.endTime}
                  onChange={(e) => setSettings((s) => ({ ...s, endTime: Number(e.target.value) }))}
                />
              </label>
            </div>
            <p className="svt-note">Clip length: {formatTime(trimLength)} / Original: {formatTime(duration)}</p>
          </section>

          <section className="svt-card">
            <h2>Video adjustments</h2>
            <div className="svt-grid">
              <label>
                Rotate
                <select
                  value={settings.rotate}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, rotate: Number(e.target.value) as 0 | 90 | 180 | 270 }))
                  }
                >
                  <option value={0}>No rotation</option>
                  <option value={90}>90°</option>
                  <option value={180}>180°</option>
                  <option value={270}>270°</option>
                </select>
              </label>

              <label>
                Resize
                <select
                  value={settings.scalePercent}
                  onChange={(e) => setSettings((s) => ({ ...s, scalePercent: Number(e.target.value) }))}
                >
                  <option value={100}>100% original</option>
                  <option value={75}>75%</option>
                  <option value={50}>50%</option>
                  <option value={25}>25%</option>
                </select>
              </label>

              <label>
                Speed
                <select
                  value={settings.speed}
                  onChange={(e) => setSettings((s) => ({ ...s, speed: Number(e.target.value) }))}
                >
                  <option value={0.5}>0.5×</option>
                  <option value={0.75}>0.75×</option>
                  <option value={1}>1×</option>
                  <option value={1.25}>1.25×</option>
                  <option value={1.5}>1.5×</option>
                  <option value={2}>2×</option>
                </select>
              </label>

              <label>
                Compression
                <select
                  value={settings.crf}
                  onChange={(e) => setSettings((s) => ({ ...s, crf: Number(e.target.value) }))}
                >
                  <option value={23}>Higher quality</option>
                  <option value={28}>Balanced</option>
                  <option value={32}>Smaller file</option>
                  <option value={36}>Maximum compression</option>
                </select>
              </label>
            </div>

            <label className="svt-check">
              <input
                type="checkbox"
                checked={settings.muted}
                onChange={(e) => setSettings((s) => ({ ...s, muted: e.target.checked }))}
              />
              Mute audio in exported video
            </label>
          </section>

          {progress && (
            <section className="svt-status" aria-live="polite">
              <div className="svt-row-between">
                <span>{progress.message}</span>
                <strong>{Math.round(progress.ratio * 100)}%</strong>
              </div>
              <div className="svt-progress">
                <div style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
              </div>
            </section>
          )}

          {error && <div className="svt-error">{error}</div>}

          <section className="svt-actions">
            <button className="svt-primary" type="button" onClick={runProcess} disabled={processing || !duration}>
              {processing ? 'Processing…' : 'Export MP4'}
            </button>
            <button type="button" onClick={runExtractAudio} disabled={processing || !duration}>
              Extract MP3 audio
            </button>
            <button type="button" onClick={reset} disabled={processing}>Reset</button>
          </section>

          <p className="svt-footnote">
            FFmpeg loads only when you process a video. Large or high-resolution videos may need significant RAM and can be slow on mobile devices.
          </p>
        </>
      )}
    </main>
  )
}
