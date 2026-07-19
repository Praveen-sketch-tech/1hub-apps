import type {
  CaptureInfo,
  CaptureOptions,
  RecordedVideoResult,
  RecorderSnapshot,
  RecordingOptions,
  RecordingState,
} from '../types'
import { getCaptureInfo, requestDisplayCapture, stopMediaStream } from './captureSupport'
import { getSupportedWebmMimeType, getVideoBitrate, isMediaRecorderSupported } from './mediaRecorderSupport'

type SnapshotListener = (snapshot: RecorderSnapshot) => void

export class ScreenRecordingController {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: BlobPart[] = []
  private state: RecordingState = 'idle'
  private error: string | null = null
  private captureInfo: CaptureInfo | null = null
  private listeners = new Set<SnapshotListener>()
  private startedAt = 0
  private pausedAt = 0
  private totalPausedMs = 0
  private elapsedBeforeStop = 0
  private tickTimer: number | null = null
  private finalizeResolver: ((value: RecordedVideoResult) => void) | null = null
  private finalizeRejecter: ((reason: Error) => void) | null = null
  private trackEndedHandler: (() => void) | null = null

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): RecorderSnapshot {
    return {
      state: this.state,
      elapsedMs: this.getElapsedMs(),
      captureInfo: this.captureInfo,
      error: this.error,
    }
  }

  getStream(): MediaStream | null {
    return this.stream
  }

  async requestCapture(options: CaptureOptions = {}): Promise<MediaStream> {
    this.ensureNotRecording()
    this.cleanupStreamOnly()
    this.setState('requesting-permission')
    this.error = null

    try {
      const stream = await requestDisplayCapture(options)
      this.attachStream(stream)
      return stream
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error('Unable to start screen capture.')
      this.error = error.message
      this.setState('error')
      throw error
    }
  }

  attachStream(stream: MediaStream): void {
    this.ensureNotRecording()
    if (!stream.getVideoTracks().length) {
      throw new Error('The provided MediaStream does not contain a video track.')
    }

    this.cleanupStreamOnly()
    this.stream = stream
    this.captureInfo = getCaptureInfo(stream)
    this.trackEndedHandler = () => {
      if (this.state === 'recording' || this.state === 'paused') {
        void this.stopRecording().catch(() => undefined)
      } else {
        this.cleanupStreamOnly()
        this.setState('idle')
      }
    }
    stream.getVideoTracks()[0]?.addEventListener('ended', this.trackEndedHandler, { once: true })
    this.setState('ready')
  }

  startRecording(options: RecordingOptions = {}): void {
    if (!this.stream) throw new Error('Choose a screen, window or tab before recording.')
    if (!isMediaRecorderSupported()) throw new Error('MediaRecorder is not supported by this browser.')
    if (this.state === 'recording' || this.state === 'paused') throw new Error('A recording is already active.')

    const mimeType = getSupportedWebmMimeType()
    const videoBitsPerSecond = getVideoBitrate(options.quality, options.videoBitsPerSecond)
    const recorderOptions: MediaRecorderOptions = {}
    if (mimeType) recorderOptions.mimeType = mimeType
    if (videoBitsPerSecond) recorderOptions.videoBitsPerSecond = videoBitsPerSecond

    this.chunks = []
    this.elapsedBeforeStop = 0
    this.totalPausedMs = 0
    this.pausedAt = 0
    this.error = null

    try {
      this.recorder = new MediaRecorder(this.stream, recorderOptions)
    } catch {
      this.recorder = new MediaRecorder(this.stream)
    }

    this.recorder.addEventListener('dataavailable', this.handleDataAvailable)
    this.recorder.addEventListener('error', this.handleRecorderError)
    this.recorder.start(1000)
    this.startedAt = performance.now()
    this.startTicker()
    this.setState('recording')
  }

  pauseRecording(): void {
    if (!this.recorder || this.recorder.state !== 'recording') return
    this.recorder.pause()
    this.pausedAt = performance.now()
    this.setState('paused')
  }

  resumeRecording(): void {
    if (!this.recorder || this.recorder.state !== 'paused') return
    if (this.pausedAt) this.totalPausedMs += performance.now() - this.pausedAt
    this.pausedAt = 0
    this.recorder.resume()
    this.setState('recording')
  }

  async stopRecording(): Promise<RecordedVideoResult> {
    if (!this.recorder || this.recorder.state === 'inactive') {
      throw new Error('There is no active recording to stop.')
    }

    if (this.state === 'paused' && this.pausedAt) {
      this.totalPausedMs += performance.now() - this.pausedAt
      this.pausedAt = 0
    }

    this.elapsedBeforeStop = this.getElapsedMs()
    this.stopTicker()
    this.setState('stopping')

    const resultPromise = new Promise<RecordedVideoResult>((resolve, reject) => {
      this.finalizeResolver = resolve
      this.finalizeRejecter = reject
    })

    this.recorder.addEventListener('stop', this.handleRecorderStop, { once: true })
    this.recorder.stop()
    return resultPromise
  }

  cancelCapture(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop()
      } catch {
        // Ignore shutdown race during cancellation.
      }
    }
    this.stopTicker()
    this.cleanupRecorder()
    this.cleanupStreamOnly()
    this.resetTiming()
    this.error = null
    this.setState('idle')
  }

  dispose(): void {
    this.cancelCapture()
    this.listeners.clear()
  }

  private handleDataAvailable = (event: BlobEvent): void => {
    if (event.data.size > 0) this.chunks.push(event.data)
  }

  private handleRecorderError = (): void => {
    const error = new Error('The browser reported a recording error.')
    this.error = error.message
    this.finalizeRejecter?.(error)
    this.finalizeResolver = null
    this.finalizeRejecter = null
    this.stopTicker()
    this.cleanupRecorder()
    this.cleanupStreamOnly()
    this.setState('error')
  }

  private handleRecorderStop = (): void => {
    const mimeType = this.recorder?.mimeType || getSupportedWebmMimeType() || 'video/webm'
    const blob = new Blob(this.chunks, { type: mimeType })
    const info = this.captureInfo ?? { hasAudio: false }
    const result: RecordedVideoResult = {
      ...info,
      blob,
      mimeType,
      durationMs: this.elapsedBeforeStop,
      size: blob.size,
      createdAt: new Date().toISOString(),
      fileName: `screen-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`,
    }

    const resolve = this.finalizeResolver
    this.finalizeResolver = null
    this.finalizeRejecter = null
    this.cleanupRecorder()
    this.cleanupStreamOnly()
    this.setState('stopped')
    resolve?.(result)
  }

  private getElapsedMs(): number {
    if (!this.startedAt) return this.elapsedBeforeStop
    if (this.state === 'paused' && this.pausedAt) {
      return Math.max(0, this.pausedAt - this.startedAt - this.totalPausedMs)
    }
    if (this.state === 'recording' || this.state === 'stopping') {
      return Math.max(0, performance.now() - this.startedAt - this.totalPausedMs)
    }
    return this.elapsedBeforeStop
  }

  private startTicker(): void {
    this.stopTicker()
    this.tickTimer = window.setInterval(() => this.emit(), 250)
  }

  private stopTicker(): void {
    if (this.tickTimer !== null) window.clearInterval(this.tickTimer)
    this.tickTimer = null
  }

  private cleanupRecorder(): void {
    if (this.recorder) {
      this.recorder.removeEventListener('dataavailable', this.handleDataAvailable)
      this.recorder.removeEventListener('error', this.handleRecorderError)
    }
    this.recorder = null
    this.chunks = []
  }

  private cleanupStreamOnly(): void {
    if (this.stream && this.trackEndedHandler) {
      this.stream.getVideoTracks()[0]?.removeEventListener('ended', this.trackEndedHandler)
    }
    stopMediaStream(this.stream)
    this.stream = null
    this.trackEndedHandler = null
  }

  private resetTiming(): void {
    this.startedAt = 0
    this.pausedAt = 0
    this.totalPausedMs = 0
    this.elapsedBeforeStop = 0
  }

  private ensureNotRecording(): void {
    if (this.state === 'recording' || this.state === 'paused' || this.state === 'stopping') {
      throw new Error('Stop the current recording before choosing another capture source.')
    }
  }

  private setState(state: RecordingState): void {
    this.state = state
    this.emit()
  }

  private emit(): void {
    const snapshot = this.getSnapshot()
    this.listeners.forEach((listener) => listener(snapshot))
  }
}
