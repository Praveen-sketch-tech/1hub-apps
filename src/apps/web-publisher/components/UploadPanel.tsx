import { useRef, useState } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { UploadedFile } from '../types'
import { filesFromDataTransfer, filesFromFileList } from '../lib/fileReading'

interface UploadPanelProps {
  files: UploadedFile[]
  onFilesSelected: (files: UploadedFile[]) => void
  onClear: () => void
}

interface TreeNode {
  name: string
  children: Map<string, TreeNode>
  isFile: boolean
  fullPath: string
  size?: number
}

function buildTree(files: UploadedFile[]): TreeNode {
  const root: TreeNode = { name: '', children: new Map(), isFile: false, fullPath: '' }

  for (const f of files) {
    const segments = f.path.split('/')
    let node = root
    segments.forEach((segment, i) => {
      const isLast = i === segments.length - 1
      if (!node.children.has(segment)) {
        node.children.set(segment, {
          name: segment,
          children: new Map(),
          isFile: isLast,
          fullPath: segments.slice(0, i + 1).join('/'),
          size: isLast ? f.file.size : undefined,
        })
      }
      node = node.children.get(segment)!
    })
  }

  return root
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function TreeView({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const entries = [...node.children.values()].sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
    return a.name.localeCompare(b.name)
  })

  return (
    <ul className="wp-tree-list" style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      {entries.map((child) => (
        <li key={child.fullPath} className="wp-tree-item">
          {child.isFile ? (
            <span className="wp-tree-file">
              📄 {child.name}
              <span className="wp-tree-size">{formatBytes(child.size ?? 0)}</span>
            </span>
          ) : (
            <>
              <span className="wp-tree-folder">📁 {child.name}/</span>
              <TreeView node={child} depth={depth + 1} />
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

export function UploadPanel({ files, onFilesSelected, onClear }: UploadPanelProps) {
  const [dragActive, setDragActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    setBusy(true)
    try {
      const dropped = await filesFromDataTransfer(e.dataTransfer)
      if (dropped.length > 0) onFilesSelected(dropped)
    } finally {
      setBusy(false)
    }
  }

  function handleBrowse(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    const selected = filesFromFileList(e.target.files)
    if (selected.length > 0) onFilesSelected(selected)
    e.target.value = ''
  }

  const tree = buildTree(files)

  return (
    <Card className="tool-card">
      <div className="tool-stack">
        <h2 className="wp-section-title">Website Files</h2>

        <div
          className="tool-dropzone"
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          data-active={dragActive || undefined}
        >
          <p>{busy ? 'Reading files…' : 'Drag & drop your website files or a folder here'}</p>
          <div className="tool-actions">
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Browse Files
            </Button>
            <Button type="button" variant="secondary" onClick={() => folderInputRef.current?.click()}>
              Browse Folder
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleBrowse}
            style={{ display: 'none' }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // @ts-expect-error non-standard attribute, supported by Chromium/WebKit for folder picking
            webkitdirectory=""
            directory=""
            onChange={handleBrowse}
            style={{ display: 'none' }}
          />
        </div>

        {files.length > 0 && (
          <>
            <div className="wp-tree-wrapper">
              <TreeView node={tree} />
            </div>
            <div className="tool-actions">
              <span className="tool-muted">{files.length} file{files.length === 1 ? '' : 's'} selected</span>
              <Button type="button" variant="secondary" onClick={onClear}>Clear</Button>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
