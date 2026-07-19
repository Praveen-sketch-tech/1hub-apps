export { LocalScreenTabRecorderPage } from './LocalScreenTabRecorderPage'
export { chatModule } from './chatActions'
export { ScreenRecordingController } from './lib/ScreenRecordingController'
export { requestDisplayCapture, getCaptureInfo, stopMediaStream } from './lib/captureSupport'
export { getSupportedWebmMimeType, getVideoBitrate, isDisplayCaptureSupported, isMediaRecorderSupported } from './lib/mediaRecorderSupport'
export type {
  CaptureInfo,
  CaptureOptions,
  FrameRatePreference,
  RecordedVideoResult,
  RecorderSnapshot,
  RecordingOptions,
  RecordingQuality,
  RecordingState,
} from './types'
