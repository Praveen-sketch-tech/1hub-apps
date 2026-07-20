import { useEffect, useMemo, useRef, useState } from 'react'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import type {
  FrameRatePreference,
  RecordedVideoResult,
  RecorderSnapshot,
  RecordingQuality,
} from './types'
import { ScreenRecordingController } from './lib/ScreenRecordingController'
import { isDisplayCaptureSupported, isMediaRecorderSupported } from './lib/mediaRecorderSupport'
import { downloadRecording, formatBytes, formatDuration } from './lib/recordingUtils'

const initialSnapshot: RecorderSnapshot = {
  state: 'idle',
  elapsedMs: 0,
  captureInfo: null,
  error: null,
}

const stateLabel: Record<RecorderSnapshot['state'], string> = {
  idle: 'Idle',
  'requesting-permission': 'Waiting for permission',
  ready: 'Source selected',
  recording: 'Recording',
  paused: 'Paused',
  stopping: 'Finalizing',
  stopped: 'Recording complete',
  error: 'Error',
}

export function LocalScreenTabRecorderPage() {
  const controllerRef = useRef<ScreenRecordingController | null>(null)
  if (!controllerRef.current) controllerRef.current = new ScreenRecordingController()
  const controller = controllerRef.current

  const [snapshot, setSnapshot] = useState<RecorderSnapshot>(initialSnapshot)
  const [frameRate, setFrameRate] = useState<FrameRatePreference>('auto')
  const [quality, setQuality] = useState<RecordingQuality>('high')
  const [customMbps, setCustomMbps] = useState(8)
  const [includeAudio, setIncludeAudio] = useState(true)
  const [result, setResult] = useState<RecordedVideoResult | null>(null)
  const [uiError, setUiError] = useState('')
  const liveVideoRef = useRef<HTMLVideoElement | null>(null)

  const displaySupported = isDisplayCaptureSupported()
  const recorderSupported = isMediaRecorderSupported()
  const previewUrl = useMemo(() => (result ? URL.createObjectURL(result.blob) : ''), [result])

  useEffect(() => controller.subscribe(setSnapshot), [controller])

  useEffect(() => {
    const video = liveVideoRef.current
    if (!video) return
    video.srcObject = controller.getStream()
  }, [controller, snapshot.state])

  useEffect(() => () => {
    controller.dispose()
  }, [controller])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function chooseSource(): Promise<void> {
    setUiError('')
    setResult(null)
    try {
      const stream = await controller.requestCapture({ frameRate, includeAudio })
      if (liveVideoRef.current) liveVideoRef.current.srcObject = stream
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to choose a capture source.'
      setUiError(message)
    }
  }

  function startRecording(): void {
    setUiError('')
    setResult(null)
    try {
      controller.startRecording({
        quality,
        videoBitsPerSecond: quality === 'custom' ? customMbps * 1_000_000 : undefined,
      })
    } catch (caught) {
      setUiError(caught instanceof Error ? caught.message : 'Unable to start recording.')
    }
  }

  async function stopRecording(): Promise<void> {
    setUiError('')
    try {
      const recorded = await controller.stopRecording()
      setResult(recorded)
      if (liveVideoRef.current) liveVideoRef.current.srcObject = null
    } catch (caught) {
      setUiError(caught instanceof Error ? caught.message : 'Unable to stop recording.')
    }
  }

  function reset(): void {
    controller.cancelCapture()
    setResult(null)
    setUiError('')
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null
  }

  const canChoose = !['recording', 'paused', 'stopping', 'requesting-permission'].includes(snapshot.state)
  const canStart = snapshot.state === 'ready'

  return (
    <div className="tool-page lstr-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <ToolAppHeader
          appNumber="018"
          title="Local Screen & Tab Recorder"
          description="Record a user-selected browser tab, window or screen locally with explicit browser permission, reusable recording controls and WebM export."
        />
{!displaySupported || !recorderSupported ? (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <h2 className="font-semibold">Recording is not supported in this browser</h2>
            <p className="mt-2 text-sm leading-6">
              {!displaySupported
                ? 'This browser does not expose the screen-capture API required to let you choose a screen, window or tab.'
                : 'This browser does not expose MediaRecorder, which is required to create the local recording.'}
            </p>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="tool-panel space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Recording setup</h2>
                <p className="tool-muted mt-1 text-sm leading-6">Your browser will show its native source picker. This app cannot silently select or capture a tab, window or display.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="tool-label text-sm font-medium">
                  Frame-rate preference
                  <select value={String(frameRate)} onChange={(event) => setFrameRate(event.target.value === 'auto' ? 'auto' : Number(event.target.value) as FrameRatePreference)} className="tool-select mt-1">
                    <option value="auto">Auto</option>
                    <option value="15">15 FPS</option>
                    <option value="24">24 FPS</option>
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS</option>
                  </select>
                </label>

                <label className="tool-label text-sm font-medium">
                  Recording quality
                  <select value={quality} onChange={(event) => setQuality(event.target.value as RecordingQuality)} className="tool-select mt-1">
                    <option value="low">Low</option>
                    <option value="standard">Standard</option>
                    <option value="high">High</option>
                    <option value="very-high">Very high</option>
                    <option value="custom">Custom bitrate</option>
                  </select>
                </label>
              </div>

              {quality === 'custom' && (
                <label className="tool-label block text-sm font-medium">
                  Video bitrate: {customMbps} Mbps
                  <input type="range" min={1} max={30} value={customMbps} onChange={(event) => setCustomMbps(Number(event.target.value))} className="mt-2 w-full" />
                </label>
              )}

              <label className="tool-card flex items-start gap-3 p-3 text-sm">
                <input type="checkbox" checked={includeAudio} onChange={(event) => setIncludeAudio(event.target.checked)} className="mt-1" />
                <span><strong>Request available tab/system audio.</strong><span className="tool-muted mt-1 block text-xs font-normal">Audio is not guaranteed. Availability depends on the browser, operating system and source you choose.</span></span>
              </label>

              <button type="button" disabled={!canChoose} onClick={() => void chooseSource()} className="tool-button tool-button-primary w-full py-3">
                {snapshot.state === 'requesting-permission' ? 'Waiting for browser selection…' : 'Choose Screen / Window / Tab'}
              </button>

              <div className="tool-card-muted tool-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">State</span>
                  <span className="tool-border rounded-full border px-3 py-1 text-xs font-semibold">{stateLabel[snapshot.state]}</span>
                </div>
                <div className="mt-4 text-center font-mono text-4xl font-semibold tracking-wider">{formatDuration(snapshot.elapsedMs)}</div>
              </div>

              {snapshot.captureInfo && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Resolution" value={snapshot.captureInfo.width && snapshot.captureInfo.height ? `${snapshot.captureInfo.width} × ${snapshot.captureInfo.height}` : 'Browser did not report'} />
                  <Info label="Frame rate" value={snapshot.captureInfo.frameRate ? `${Math.round(snapshot.captureInfo.frameRate)} FPS` : 'Browser did not report'} />
                  <Info label="Source type" value={snapshot.captureInfo.displaySurface || 'Not reported'} />
                  <Info label="Audio" value={snapshot.captureInfo.hasAudio ? 'Captured' : includeAudio ? 'Unavailable / not selected' : 'Not requested'} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button type="button" disabled={!canStart} onClick={startRecording} className="tool-button">Start</button>
                <button type="button" disabled={snapshot.state !== 'recording'} onClick={() => controller.pauseRecording()} className="tool-button">Pause</button>
                <button type="button" disabled={snapshot.state !== 'paused'} onClick={() => controller.resumeRecording()} className="tool-button">Resume</button>
                <button type="button" disabled={!['recording', 'paused'].includes(snapshot.state)} onClick={() => void stopRecording()} className="tool-button">Stop</button>
              </div>

              {(uiError || snapshot.error) && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{uiError || snapshot.error}</div>}
            </section>

            <section className="tool-panel space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Live view & recording result</h2>
                <p className="tool-muted mt-1 text-sm">The selected source is shown locally while capture is active. Your recording stays in the browser until you download it.</p>
              </div>

              {['ready', 'recording', 'paused', 'stopping'].includes(snapshot.state) ? (
                <video ref={liveVideoRef} autoPlay muted playsInline className="max-h-[520px] min-h-64 w-full rounded-xl bg-black object-contain" />
              ) : result ? (
                <video src={previewUrl} controls playsInline className="max-h-[520px] min-h-64 w-full rounded-xl bg-black object-contain" />
              ) : (
                <div className="tool-dropzone flex min-h-72 items-center justify-center p-8 text-center text-sm">Choose a source to see the local live preview. After you stop recording, the WebM preview will appear here.</div>
              )}

              {result && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <Info label="Duration" value={formatDuration(result.durationMs)} />
                    <Info label="File size" value={formatBytes(result.size)} />
                    <Info label="Resolution" value={result.width && result.height ? `${result.width} × ${result.height}` : 'Not reported'} />
                    <Info label="Audio" value={result.hasAudio ? 'Included' : 'No audio track'} />
                  </div>
                  <div className="tool-card-muted tool-card p-3 text-xs">Output: {result.fileName}<br />MIME: {result.mimeType}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => downloadRecording(result.blob, result.fileName)} className="tool-button tool-button-primary py-3">Download WebM</button>
                    <button type="button" onClick={reset} className="tool-button py-3">Record Again</button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        <section className="tool-panel">
          <h2 className="text-lg font-semibold">Reusable demo-video foundation</h2>
          <p className="tool-muted mt-2 text-sm leading-6">The page uses a UI-independent ScreenRecordingController. Future capture modules and demo orchestrators can attach a user-approved MediaStream and control start, pause, resume and stop without duplicating the recording engine. Browser permission and source selection always remain user-controlled.</p>
        </section>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="tool-card p-3"><div className="tool-muted text-xs">{label}</div><div className="mt-1 font-medium">{value}</div></div>
}
