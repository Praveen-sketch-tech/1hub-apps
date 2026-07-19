# App #022 — Web Page Snapshot & Local Simulation

Browser-local snapshot and temporary simulation module for the 1 Hub Apps automated demo-video mission.

## Core reusable capabilities

- Build a sanitized local snapshot from user-provided or legitimately accessible HTML.
- Build a simulation page from App #021-style Page Map / Feature Map JSON.
- Preserve original source URL and metadata.
- Preview using browser-local Blob URLs.
- Save/load projects with IndexedDB.
- Optionally save project JSON to OPFS when supported.
- Export/import reusable snapshot-project JSON.
- Expose a UI-independent `SimulationTargetDescriptor` for future interaction-engine adapters.

## Security boundaries

This app does not bypass CORS, authentication, paywalls, protected resources, or cross-origin DOM restrictions. Scripts and unsafe executable HTML are removed from stored preview HTML. Direct URL import only succeeds where the browser is legitimately permitted to fetch the page.

## Identity

- App number: `022`
- Folder: `web-page-snapshot-local-simulation`
- Route: `/apps/web-page-snapshot-local-simulation`
- Main export: `WebPageSnapshotLocalSimulationPage`
- Chat app id: `web-page-snapshot-local-simulation`
