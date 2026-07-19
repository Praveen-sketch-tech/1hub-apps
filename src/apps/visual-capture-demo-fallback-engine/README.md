# App #025 — Visual Capture & Demo Fallback Engine

Browser-first fallback module for the automated demo-video mission.

- Consumes the exact App #020 `DemoSequence` / `DemoAction` shape.
- Converts actions into reusable timed visual cues.
- Supports cursor, click, caption, focus/highlight, zoom and scroll cue metadata.
- Starts screen/window/tab capture only after explicit browser permission.
- Prefers a reusable App #018 recorder adapter when registered.
- Provides browser-native getDisplayMedia fallback for standalone use.
- Records composited browser-local WebM and hands it onward to App #019.
- Never claims unverified functionality.

Identity:
- App number: 025
- Folder: visual-capture-demo-fallback-engine
- Route: /apps/visual-capture-demo-fallback-engine
- Export: VisualCaptureDemoFallbackEnginePage
- Chat app id: visual-capture-demo-fallback-engine
