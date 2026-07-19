import type { SnapshotProject, SnapshotProjectSummary } from '../types/snapshot'

const DB_NAME = 'one-hub-apps-snapshot-projects'
const DB_VERSION = 1
const STORE_NAME = 'projects'

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not supported in this browser.'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open snapshot database.'))
  })
}

export async function saveSnapshotProject(project: SnapshotProject): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(project)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save snapshot project.'))
  })
  db.close()
}

export async function loadSnapshotProject(id: string): Promise<SnapshotProject | undefined> {
  const db = await openDb()
  const value = await new Promise<SnapshotProject | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id)
    request.onsuccess = () => resolve(request.result as SnapshotProject | undefined)
    request.onerror = () => reject(request.error ?? new Error('Failed to load snapshot project.'))
  })
  db.close()
  return value
}

export async function listSnapshotProjects(): Promise<SnapshotProjectSummary[]> {
  const db = await openDb()
  const projects = await new Promise<SnapshotProject[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve((request.result as SnapshotProject[]) || [])
    request.onerror = () => reject(request.error ?? new Error('Failed to list snapshot projects.'))
  })
  db.close()

  return projects
    .map((project) => ({
      id: project.id,
      name: project.name,
      sourceUrl: project.metadata.sourceUrl,
      updatedAt: project.updatedAt,
      accessMode: project.metadata.accessMode,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function deleteSnapshotProject(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete snapshot project.'))
  })
  db.close()
}
