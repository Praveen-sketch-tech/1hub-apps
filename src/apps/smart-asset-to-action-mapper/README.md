# App #024 — Smart Asset-to-Action Mapper

Browser-local reusable mapper for the 1 Hub Apps automated demo-video mission.

## Responsibilities

- Consume App #023 `assetRequirements`.
- Determine the appropriate App #017 asset-factory capability.
- Produce structured `AssetGenerationRequest` objects.
- Produce App #020-compatible upload action descriptors.
- Support user-provided local file mapping.
- Execute generation only through a registered App #017 reusable `AssetFactoryAdapter`.
- Never duplicate App #017 asset-generation implementation.
- Export structured mapping plans for App #026 orchestration.

## Important integration note

The current Knowledge Base does not lock the exact TypeScript export names of App #017. Therefore this package intentionally does not guess a compile-time import path or function name. It exposes `registerAssetFactoryAdapter()` so the real App #017 reusable processing layer can be connected using its actual repository contract without changing mapping logic.

## Identity

- App number: `024`
- Folder: `smart-asset-to-action-mapper`
- Route: `/apps/smart-asset-to-action-mapper`
- Main export: `SmartAssetToActionMapperPage`
- Chat app id: `smart-asset-to-action-mapper`
