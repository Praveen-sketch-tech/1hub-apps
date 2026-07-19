import type {
  AssetMappingPlan,
  AssetRequirement,
  GeneratedAsset,
} from '../types/assetMapping'

function acceptsFile(requirement: AssetRequirement, file: File): boolean {
  const accept = requirement.accept?.trim()
  if (!accept) return true

  const rules = accept.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()

  return rules.some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule)
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1))
    return type === rule
  })
}

export function mapUserFileToRequirement(
  plan: AssetMappingPlan,
  requirementId: string,
  file: File,
): { plan: AssetMappingPlan; asset: GeneratedAsset } {
  const mapping = plan.mappings.find((item) => item.requirement.id === requirementId)
  if (!mapping) throw new Error('Asset requirement was not found.')
  if (!acceptsFile(mapping.requirement, file)) {
    throw new Error(`File ${file.name} does not match the requirement accept rules: ${mapping.requirement.accept}.`)
  }

  const asset: GeneratedAsset = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `user-asset-${Date.now()}`,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    blob: file,
    source: 'user-provided',
  }

  return {
    asset,
    plan: {
      ...plan,
      mappings: plan.mappings.map((item) =>
        item.requirement.id === requirementId
          ? {
              ...item,
              status: 'mapped',
              asset: {
                id: asset.id,
                name: asset.name,
                mimeType: asset.mimeType,
                source: asset.source,
              },
              uploadAction: {
                ...item.uploadAction,
                fileName: asset.name,
                fileType: asset.mimeType,
              },
              notes: [...item.notes, 'Mapped to a user-provided local file.'],
            }
          : item,
      ),
    },
  }
}
