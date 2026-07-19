# App #021 — Website Structure & Feature Analyzer

Browser-first, rules-based page structure analyzer for 1 Hub Apps.

- Analyzes pasted HTML, local HTML files, and URL responses only when browser fetch access is legitimately available.
- Produces a reusable `PageFeatureMap` with detected controls, workflow hints, access mode, and structured fallback guidance.
- Does not claim arbitrary cross-origin DOM access or bypass browser security.
- Core analyzer is UI-independent and reused by App UI and Hub Assistant actions.
- Future App #023 can consume the generated feature/workflow map; App #022/#025 can handle fallback modes.

Main export: `WebsiteStructureFeatureAnalyzerPage`.
