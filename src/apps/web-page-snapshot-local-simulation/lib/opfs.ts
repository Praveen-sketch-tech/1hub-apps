import type { SnapshotProject } from '../types/snapshot'

export async function saveProjectToOpfs(
  project: SnapshotProject,
  fileName = `${project.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'snapshot'}.json`,
): Promise<string> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.getDirectory !== 'function'
  ) {
    throw new Error('OPFS is not supported in this browser.')
  }

  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(fileName, { create: true })
  const writable = await handle.createWritable()
  await writable.write(JSON.stringify(project, null, 2))
  await writable.close()
  return fileName
}
