import type {
  AssetFactoryAdapter,
  AssetFactoryCapability,
  AssetMappingPlan,
  ExecuteMappingResult,
  GeneratedAsset,
} from '../types/assetMapping'

let registeredAdapter: AssetFactoryAdapter | null = null

export function registerAssetFactoryAdapter(adapter: AssetFactoryAdapter): () => void {
  if (adapter.providerAppId !== 'universal-test-asset-factory') {
    throw new Error('Asset factory adapter must identify App #017 as universal-test-asset-factory.')
  }
  registeredAdapter = adapter
  return () => {
    if (registeredAdapter === adapter) registeredAdapter = null
  }
}

export function getAssetFactoryAdapter(): AssetFactoryAdapter | null {
  return registeredAdapter
}

export function canGenerateCapability(capability: AssetFactoryCapability): boolean {
  return !!registeredAdapter?.supports(capability)
}

export async function executeAssetMappingPlan(plan: AssetMappingPlan): Promise<ExecuteMappingResult> {
  if (!registeredAdapter) {
    throw new Error(
      'App #017 reusable asset-factory adapter is not registered in this runtime. The mapping plan is valid, but generation cannot be claimed as completed.',
    )
  }

  const assets: GeneratedAsset[] = []
  const mappings = []

  for (const mapping of plan.mappings) {
    if (!registeredAdapter.supports(mapping.generationRequest.capability)) {
      mappings.push({
        ...mapping,
        status: 'unsupported' as const,
        notes: [...mapping.notes, `App #017 adapter does not expose ${mapping.generationRequest.capability}.`],
      })
      continue
    }

    const asset = await registeredAdapter.generate(mapping.generationRequest)
    assets.push(asset)
    mappings.push({
      ...mapping,
      status: 'mapped' as const,
      asset: {
        id: asset.id,
        name: asset.name,
        mimeType: asset.mimeType,
        source: asset.source,
        capability: asset.capability,
      },
      uploadAction: {
        ...mapping.uploadAction,
        fileName: asset.name,
        fileType: asset.mimeType,
      },
    })
  }

  return {
    plan: { ...plan, mappings },
    assets,
  }
}
