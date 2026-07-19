# App #026 — Automated Demo Workflow Orchestrator

Browser-first orchestration layer for the 1 Hub Apps automated demo-video mission.

## Responsibilities

- Create and track structured demo workflow jobs.
- Choose among direct, snapshot/local-simulation, and visual-capture fallback strategies.
- Register and invoke reusable stage adapters from existing apps.
- Pass structured outputs between stages.
- Track stage status, attempts, errors, warnings and progress.
- Support retries and truthful waiting-user checkpoints.
- Pause before permission-gated capture when required.
- Export/import workflow state JSON.
- Avoid duplicating analyzer, snapshot, flow, asset, simulation, capture or video-processing implementations.

## Intended adapter chain

- #021 Website Structure & Feature Analyzer → analyze
- #022 Web Page Snapshot & Local Simulation → snapshot
- #023 Rule-Based Demo Flow Builder → build-flow
- #024 Smart Asset-to-Action Mapper → prepare-assets
- #020 Web Interaction Simulation Engine → simulate
- #018 / #025 capture capabilities → capture
- #019 Browser Video Processing Studio → process-video

## Identity

- App number: 026
- Folder: automated-demo-workflow-orchestrator
- Route: /apps/automated-demo-workflow-orchestrator
- Export: AutomatedDemoWorkflowOrchestratorPage
- Chat app id: automated-demo-workflow-orchestrator
