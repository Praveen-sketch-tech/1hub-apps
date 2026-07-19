import { useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { ArchiveEntryList } from './components/ArchiveEntryList'
import {
  createZip,
  extractEntries,
  formatBytes,
  isZipFile,
  loadZip,
  safeDownloadName,
  type ArchiveEntry,
} from './lib/archive'
import './styles.css'

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function SmartArchiveToolsPage() {
  const [files, setFiles] = useState<File[]>([])
  const [archiveName, setArchiveName] = useState('archive.zip')
  const [openedName, setOpenedName] = useState('')
  const [entries, setEntries] = useState<ArchiveEntry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openedZip, setOpenedZip] = useState<JSZip | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const folderInputRef = useRef<HTMLInputElement>(null)

  const totalInputSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files])
  const fileEntries = useMemo(() => entries.filter((entry) => !entry.isDirectory), [entries])

  function addFiles(nextFiles: File[]) {
    setFiles((current) => {
      const map = new Map(current.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]))
      for (const file of nextFiles) {
        map.set(`${file.name}:${file.size}:${file.lastModified}`, file)
      }
      return [...map.values()]
    })
    setMessage('')
  }

  async function handleCreateZip() {
    setBusy(true)
    setMessage('')
    try {
      const blob = await createZip(files)
      const name = archiveName.trim().toLowerCase().endsWith('.zip')
        ? archiveName.trim()
        : `${archiveName.trim() || 'archive'}.zip`
      downloadBlob(blob, name)
      setMessage(`Created ${name} successfully.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create ZIP.')
    } finally {
      setBusy(false)
    }
  }

  async function handleOpenZip(file?: File) {
    if (!file) return
    if (!isZipFile(file)) {
      setMessage('Please choose a valid ZIP file.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const loaded = await loadZip(file)
      setOpenedZip(loaded.zip)
      setEntries(loaded.entries)
      setOpenedName(file.name)
      setSelected(new Set())
      setMessage(`Opened ${file.name}: ${loaded.entries.filter((entry) => !entry.isDirectory).length} files.`)
    } catch (error) {
      setOpenedZip(null)
      setEntries([])
      setOpenedName('')
      setMessage(error instanceof Error ? error.message : 'Could not open this ZIP file.')
    } finally {
      setBusy(false)
    }
  }

  function toggleSelected(path: string) {
    setSelected((current) => {
      const next = new Set(current)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  async function extract(paths: string[]) {
    if (!openedZip || !paths.length) return
    setBusy(true)
    setMessage('')
    try {
      const output = await extractEntries(openedZip, paths)
      for (const item of output) downloadBlob(item.blob, safeDownloadName(item.path))
      setMessage(`Extracted ${output.length} file${output.length === 1 ? '' : 's'}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Extraction failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="sat-page">
      <ToolAppHeader
        appNumber="014"
        title="Smart Archive Tools"
        description="Create, inspect, and extract ZIP archives privately in your browser."
      />

      <div className="sat-topline">
</div>

      <div className="sat-grid">
        <section className="sat-card">
          <h2>Create ZIP</h2>
          <p className="sat-muted">Add files, remove anything you do not need, then download one compressed ZIP.</p>

          <div className="sat-actions sat-wrap">
            <label className="sat-button sat-button-primary">
              Add files
              <input
                hidden
                type="file"
                multiple
                onChange={(event) => addFiles(Array.from(event.target.files || []))}
              />
            </label>
            <button className="sat-button" type="button" onClick={() => folderInputRef.current?.click()}>
              Add folder
            </button>
            <input
              ref={folderInputRef}
              hidden
              type="file"
              multiple
              {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
              onChange={(event) => addFiles(Array.from(event.target.files || []))}
            />
            <button className="sat-button" type="button" disabled={!files.length} onClick={() => setFiles([])}>
              Clear
            </button>
          </div>

          <div className="sat-field">
            <label htmlFor="archive-name">Archive name</label>
            <input
              id="archive-name"
              value={archiveName}
              onChange={(event) => setArchiveName(event.target.value)}
              placeholder="archive.zip"
            />
          </div>

          <div className="sat-summary">
            <span>{files.length} file{files.length === 1 ? '' : 's'}</span>
            <span>{formatBytes(totalInputSize)}</span>
          </div>

          <div className="sat-file-list">
            {files.map((file, index) => (
              <div className="sat-file-row" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                <span>
                  <strong>{file.name}</strong>
                  <small>{formatBytes(file.size)}</small>
                </span>
                <button
                  className="sat-link-button"
                  type="button"
                  onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </button>
              </div>
            ))}
            {!files.length && <p className="sat-muted">No files added yet.</p>}
          </div>

          <button
            className="sat-button sat-button-primary sat-full"
            type="button"
            disabled={!files.length || busy}
            onClick={handleCreateZip}
          >
            {busy ? 'Processing…' : 'Create & download ZIP'}
          </button>
        </section>

        <section className="sat-card">
          <h2>Open & Extract ZIP</h2>
          <p className="sat-muted">Browse the archive structure and extract selected files or everything.</p>

          <label className="sat-dropzone">
            <strong>Choose ZIP file</strong>
            <span>ZIP archives are read locally in this browser.</span>
            <input
              hidden
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={(event) => handleOpenZip(event.target.files?.[0])}
            />
          </label>

          {openedName && (
            <>
              <div className="sat-summary">
                <span><strong>{openedName}</strong></span>
                <span>{fileEntries.length} files</span>
              </div>

              <div className="sat-actions sat-wrap">
                <button
                  className="sat-button"
                  type="button"
                  onClick={() => setSelected(new Set(fileEntries.map((entry) => entry.path)))}
                >
                  Select all
                </button>
                <button className="sat-button" type="button" onClick={() => setSelected(new Set())}>
                  Clear selection
                </button>
                <button
                  className="sat-button sat-button-primary"
                  type="button"
                  disabled={!selected.size || busy}
                  onClick={() => extract([...selected])}
                >
                  Extract selected ({selected.size})
                </button>
                <button
                  className="sat-button sat-button-primary"
                  type="button"
                  disabled={!fileEntries.length || busy}
                  onClick={() => extract(fileEntries.map((entry) => entry.path))}
                >
                  Extract all
                </button>
              </div>

              <ArchiveEntryList entries={entries} selected={selected} onToggle={toggleSelected} />
            </>
          )}
        </section>
      </div>

      {message && <div className="sat-message" role="status">{message}</div>}
    </main>
  )
}

export default SmartArchiveToolsPage
