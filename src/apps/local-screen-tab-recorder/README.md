# App #018 — Local Screen & Tab Recorder

Browser-local, permission-safe screen/window/tab recording for 1 Hub Apps.

## Route

`/apps/local-screen-tab-recorder`

## Main export

`LocalScreenTabRecorderPage`

## Reusable architecture

The React UI delegates capture and MediaRecorder lifecycle management to `ScreenRecordingController`. Future modules can either call `requestCapture()` from a user gesture or pass an already user-approved `MediaStream` to `attachStream(stream)`, then control recording through `startRecording()`, `pauseRecording()`, `resumeRecording()` and `stopRecording()`.

The controller does not bypass browser capture permissions and cannot silently choose a capture source.

## Output

Local WebM recording when supported by the browser.
