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
    <div className="tool-page min-h-screen px-4 py-6 sm:px-6 lg:px-8">
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
            <section className="space-y-5 rounded-2xl border border-[var(--tool-border)] bg-[var(--tool-surface)] p-5 shadow-sm ">
              <div>
                <h2 className="text-lg font-semibold text-[var(--tool-text)]">Recording setup</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--tool-muted)]">Your browser will show its native source picker. This app cannot silently select or capture a tab, window or display.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Frame-rate preference
                  <select value={String(frameRate)} onChange={(event) => setFrameRate(event.target.value === 'auto' ? 'auto' : Number(event.target.value) as FrameRatePreference)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                    <option value="auto">Auto</option>
                    <option value="15">15 FPS</option>
                    <option value="24">24 FPS</option>
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Recording quality
                  <select value={quality} onChange={(event) => setQuality(event.target.value as RecordingQuality)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                    <option value="low">Low</option>
                    <option value="standard">Standard</option>
                    <option value="high">High</option>
                    <option value="very-high">Very high</option>
                    <option value="custom">Custom bitrate</option>
                  </select>
                </label>
              </div>

              {quality === 'custom' && (
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Video bitrate: {customMbps} Mbps
                  <input type="range" min={1} max={30} value={customMbps} onChange={(event) => setCustomMbps(Number(event.target.value))} className="mt-2 w-full" />
                </label>
              )}

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={includeAudio} onChange={(event) => setIncludeAudio(event.target.checked)} className="mt-1" />
                <span><strong>Request available tab/system audio.</strong><span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">Audio is not guaranteed. Availability depends on the browser, operating system and source you choose.</span></span>
              </label>

              <button type="button" disabled={!canChoose} onClick={() => void chooseSource()} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900">
                {snapshot.state === 'requesting-permission' ? 'Waiting for browser selection…' : 'Choose Screen / Window / Tab'}
              </button>

              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">State</span>
                  <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">{stateLabel[snapshot.state]}</span>
                </div>
                <div className="mt-4 text-center font-mono text-4xl font-semibold tracking-wider text-slate-950 dark:text-white">{formatDuration(snapshot.elapsedMs)}</div>
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
                <button type="button" disabled={!canStart} onClick={startRecording} className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-900 disabled:opacity-40 dark:border-slate-600 dark:text-white">Start</button>
                <button type="button" disabled={snapshot.state !== 'recording'} onClick={() => controller.pauseRecording()} className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-900 disabled:opacity-40 dark:border-slate-600 dark:text-white">Pause</button>
                <button type="button" disabled={snapshot.state !== 'paused'} onClick={() => controller.resumeRecording()} className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-900 disabled:opacity-40 dark:border-slate-600 dark:text-white">Resume</button>
                <button type="button" disabled={!['recording', 'paused'].includes(snapshot.state)} onClick={() => void stopRecording()} className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-900 disabled:opacity-40 dark:border-slate-600 dark:text-white">Stop</button>
              </div>

              {(uiError || snapshot.error) && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{uiError || snapshot.error}</div>}
            </section>

            <section className="space-y-5 rounded-2xl border border-[var(--tool-border)] bg-[var(--tool-surface)] p-5 shadow-sm ">
              <div>
                <h2 className="text-lg font-semibold text-[var(--tool-text)]">Live view & recording result</h2>
                <p className="mt-1 text-sm text-[var(--tool-muted)]">The selected source is shown locally while capture is active. Your recording stays in the browser until you download it.</p>
              </div>

              {['ready', 'recording', 'paused', 'stopping'].includes(snapshot.state) ? (
                <video ref={liveVideoRef} autoPlay muted playsInline className="max-h-[520px] min-h-64 w-full rounded-xl bg-black object-contain" />
              ) : result ? (
                <video src={previewUrl} controls playsInline className="max-h-[520px] min-h-64 w-full rounded-xl bg-black object-contain" />
              ) : (
                <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Choose a source to see the local live preview. After you stop recording, the WebM preview will appear here.</div>
              )}

              {result && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <Info label="Duration" value={formatDuration(result.durationMs)} />
                    <Info label="File size" value={formatBytes(result.size)} />
                    <Info label="Resolution" value={result.width && result.height ? `${result.width} × ${result.height}` : 'Not reported'} />
                    <Info label="Audio" value={result.hasAudio ? 'Included' : 'No audio track'} />
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">Output: {result.fileName}<br />MIME: {result.mimeType}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => downloadRecording(result.blob, result.fileName)} className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white dark:bg-white dark:text-slate-900">Download WebM</button>
                    <button type="button" onClick={reset} className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-900 dark:border-slate-600 dark:text-white">Record Again</button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        <section className="rounded-2xl border border-[var(--tool-border)] bg-[var(--tool-surface)] p-5 shadow-sm ">
          <h2 className="text-lg font-semibold text-[var(--tool-text)]">Reusable demo-video foundation</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--tool-muted)]">The page uses a UI-independent ScreenRecordingController. Future capture modules and demo orchestrators can attach a user-approved MediaStream and control start, pause, resume and stop without duplicating the recording engine. Browser permission and source selection always remain user-controlled.</p>
        </section>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs text-slate-500 dark:text-slate-400">{label}</div><div className="mt-1 font-medium text-[var(--tool-text)]">{value}</div></div>
}
