# App #020 — Web Interaction Simulation Engine

Browser-local reusable engine for structured demo actions. The UI and Hub Assistant share app-owned schema/validation utilities; visual execution runs on an explicit `SimulationSurface` adapter.

## App identity
- Folder: `web-interaction-simulation-engine`
- Route: `/apps/web-interaction-simulation-engine`
- Export: `WebInteractionSimulationEnginePage`
- App ID: `web-interaction-simulation-engine`

## Action schema
`move`, `click`, `doubleClick`, `type`, `scroll`, `select`, `upload`, `drag`, `drop`, `focus`, `highlight`, `zoom`, `wait`.

The included playground intentionally simulates actions on a controlled local surface. It does not claim to bypass browser security or control arbitrary cross-origin pages.
