import { useMemo, useState } from 'react'
import FileDropzone from './components/FileDropzone'
import RenamePanel from './components/RenamePanel'
import type { FileRecord, RenameRules, SortDirection, SortKey } from './lib/types'
import { formatBytes, makeRecords, renamedName, sortRecords } from './lib/fileUtils'
import { hashFiles } from './lib/hash'
import { downloadBlob, fileListCsv, fileListJson, fileListText } from './lib/exportList'
import { createZip, extractZip } from './lib/zip'
import { mergeChunks, splitFile } from './lib/chunks'
import './smart-file-tools.css'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'

const initialRules: RenameRules = {
  prefix: '',
  suffix: '',
  find: '',
  replace: '',
  useRegex: false,
  startNumber: 1,
  pad: 3,
  addSequence: false,
}

export default function SmartFileToolsPage() {
  const [records, setRecords] = useState<FileRecord[]>([])
  const [rules, setRules] = useState(initialRules)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [hashProgress, setHashProgress] = useState('')
  const [chunkMb, setChunkMb] = useState(10)
  const [mergeOutput, setMergeOutput] = useState('merged-file.bin')
  const [status, setStatus] = useState('')

  const sorted = useMemo(() => sortRecords(records, sortKey, sortDirection), [records, sortKey, sortDirection])
  const totalSize = records.reduce((sum, r) => sum + r.size, 0)

  const addFiles = (files: File[]) => {
    setRecords((prev) => [...prev, ...makeRecords(files)])
    setStatus(`${files.length} file(s) added`)
  }

  const runHashes = async () => {
    setHashProgress('Starting…')
    const hashes = await hashFiles(records.map((r) => r.file), (done, total) => setHashProgress(`${done}/${total}`))
    const groups = new Map<string, string[]>()
    hashes.forEach((hash, i) => {
      const ids = groups.get(hash) || []
      ids.push(records[i].id)
      groups.set(hash, ids)
    })
    setRecords((prev) => prev.map((r, i) => ({
      ...r,
      hash: hashes[i],
      duplicateGroup: (groups.get(hashes[i])?.length || 0) > 1 ? hashes[i].slice(0, 12) : undefined,
    })))
    setHashProgress('Done')
  }

  const exportList = (kind: 'txt' | 'csv' | 'json') => {
    const content = kind === 'txt' ? fileListText(sorted) : kind === 'csv' ? fileListCsv(sorted) : fileListJson(sorted)
    const type = kind === 'json' ? 'application/json' : kind === 'csv' ? 'text/csv' : 'text/plain'
    downloadBlob(new Blob([content], { type }), `file-list.${kind}`)
  }

  const renamePreview = sorted.map((r, i) => ({ ...r, preview: renamedName(r.name, i, rules) }))

  return (
    <main className="tool-page sft-page">
      <ToolAppHeader
        appNumber="007"
        title="Smart File Tools"
        description="Rename, inspect, hash, deduplicate, archive, split and merge files directly in your browser."
      />

      <FileDropzone onFiles={addFiles} />

      {status && <div className="sft-status">{status}</div>}

      <section className="sft-summary">
        <div><strong>{records.length}</strong><span>Files</span></div>
        <div><strong>{formatBytes(totalSize)}</strong><span>Total size</span></div>
        <div><strong>{records.filter((r) => r.duplicateGroup).length}</strong><span>Duplicate files</span></div>
      </section>

      <RenamePanel rules={rules} setRules={setRules} />

      <section className="sft-card">
        <div className="sft-row-between">
          <h3>Files</h3>
          <div className="sft-inline">
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
              <option value="modified">Modified</option>
            </select>
            <button onClick={() => setSortDirection((d) => d === 'asc' ? 'desc' : 'asc')}>{sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}</button>
          </div>
        </div>

        <div className="sft-table-wrap">
          <table className="sft-table">
            <thead><tr><th>Current name</th><th>Rename preview</th><th>Size</th><th>MIME / extension</th><th>SHA-256</th><th></th></tr></thead>
            <tbody>
              {renamePreview.map((r) => (
                <tr key={r.id} className={r.duplicateGroup ? 'sft-duplicate' : ''}>
                  <td>{r.name}</td>
                  <td>{r.preview}</td>
                  <td>{formatBytes(r.size)}</td>
                  <td>{r.type}<small>{r.extension || 'no extension'}</small></td>
                  <td className="sft-hash">{r.hash || '—'}{r.duplicateGroup && <small>Duplicate group: {r.duplicateGroup}</small>}</td>
                  <td><button onClick={() => setRecords((prev) => prev.filter((x) => x.id !== r.id))}>Remove</button></td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={6} className="sft-empty">No files added yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sft-actions">
        <article className="sft-card">
          <h3>Hash & duplicate detection</h3>
          <p>Generate SHA-256 hashes locally and identify exact duplicate files.</p>
          <button disabled={!records.length} onClick={runHashes}>Generate SHA-256 hashes</button>
          {hashProgress && <span className="sft-note">{hashProgress}</span>}
        </article>

        <article className="sft-card">
          <h3>Export file list</h3>
          <p>Export file metadata and generated hashes.</p>
          <div className="sft-inline">
            <button disabled={!records.length} onClick={() => exportList('txt')}>TXT</button>
            <button disabled={!records.length} onClick={() => exportList('csv')}>CSV</button>
            <button disabled={!records.length} onClick={() => exportList('json')}>JSON</button>
          </div>
        </article>

        <article className="sft-card">
          <h3>Create ZIP</h3>
          <p>Bundle selected files into a local ZIP archive.</p>
          <button disabled={!records.length} onClick={() => createZip(records.map((r) => r.file), 'smart-file-tools.zip')}>Create ZIP</button>
        </article>

        <article className="sft-card">
          <h3>Extract ZIP</h3>
          <p>Select one ZIP file from the list and extract its contents locally.</p>
          <button
            disabled={!records.some((r) => r.extension === 'zip')}
            onClick={async () => {
              const target = records.find((r) => r.extension === 'zip')
              if (!target) return
              const extracted = await extractZip(target.file)
              extracted.forEach((item) => downloadBlob(item.blob, item.name))
            }}
          >
            Extract first ZIP
          </button>
        </article>

        <article className="sft-card">
          <h3>Split large file</h3>
          <label>Chunk size (MB)<input type="number" min={1} value={chunkMb} onChange={(e) => setChunkMb(Math.max(1, Number(e.target.value) || 1))} /></label>
          <button disabled={!records.length} onClick={() => splitFile(records[0].file, chunkMb * 1024 * 1024)}>Split first file</button>
        </article>

        <article className="sft-card">
          <h3>Merge chunks</h3>
          <label>Output filename<input value={mergeOutput} onChange={(e) => setMergeOutput(e.target.value)} /></label>
          <button disabled={!records.length} onClick={() => mergeChunks(records.map((r) => r.file), mergeOutput)}>Merge files in sorted name order</button>
        </article>
      </section>

      <section className="sft-card sft-footer-actions">
        <button onClick={() => setRecords([])} disabled={!records.length}>Clear all</button>
      </section>
    </main>
  )
}
