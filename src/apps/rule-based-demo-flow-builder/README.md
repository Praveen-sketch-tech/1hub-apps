# App #023 — Rule-Based Demo Flow Builder

Deterministic browser-local demo workflow builder for the 1 Hub Apps automated demo-video mission.

## Reusable capabilities

- Consume App #021 `PageFeatureMap`.
- Generate deterministic primary and alternative demo flows.
- Manual editable fallback when page information is insufficient.
- Reorder, edit, enable/disable, label and time demo steps.
- Validate flow collections.
- Expose file-input `assetRequirements` for App #024.
- Convert the selected flow to the exact App #020 `DemoSequence` / `DemoAction` shape used by the current generated App #020 package.
- Export Demo Flow JSON and App #020 sequence JSON.
- Real Hub Assistant actions using the same reusable functions as the UI.

## Identity

- App number: `023`
- Folder: `rule-based-demo-flow-builder`
- Route: `/apps/rule-based-demo-flow-builder`
- Main export: `RuleBasedDemoFlowBuilderPage`
- Chat app id: `rule-based-demo-flow-builder`

No AI, external API, server, or VPS is required.
