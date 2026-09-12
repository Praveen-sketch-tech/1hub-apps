import { useEffect, useRef, useState } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { UploadedFile } from '../types'
import { buildPreview } from '../lib/preview'

interface PreviewPanelProps {
  files: UploadedFile[]
  entryPath: string | null
}

type DeviceMode = 'desktop' | 'mobile'

export function PreviewPanel({ files, entryPath }: PreviewPanelProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const revokeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false

    async function build() {
      setError(null)

      // Release the previous preview's blob URLs before building a new one.
      revokeRef.current?.()
      revokeRef.current = null
      setPreviewUrl(null)

      if (!entryPath || files.length === 0) return

      try {
        const built = await buildPreview(files, entryPath)
        if (cancelled) {
          built.revoke()
          return
        }
        revokeRef.current = built.revoke
        setPreviewUrl(built.url)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not build preview.')
      }
    }

    build()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, entryPath, refreshTick])

  useEffect(() => {
    return () => {
      revokeRef.current?.()
    }
  }, [])

  return (
    <Card className="tool-card">
      <div className="tool-stack">
        <div className="tool-actions" style={{ justifyContent: 'space-between' }}>
          <h2 className="wp-section-title">Preview</h2>
          <div className="tool-actions">
            <Button
              type="button"
              variant={device === 'desktop' ? 'primary' : 'secondary'}
              onClick={() => setDevice('desktop')}
            >
              🖥️ Desktop
            </Button>
            <Button
              type="button"
              variant={device === 'mobile' ? 'primary' : 'secondary'}
              onClick={() => setDevice('mobile')}
            >
              📱 Mobile
            </Button>
            <Button type="button" variant="secondary" onClick={() => setRefreshTick((t) => t + 1)}>
              ↻ Refresh
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!previewUrl}
              onClick={() => previewUrl && window.open(previewUrl, '_blank', 'noopener,noreferrer')}
            >
              Open in new tab
            </Button>
          </div>
        </div>

        {error && <p className="wp-error">{error}</p>}

        {!error && !previewUrl && (
          <p className="tool-muted">Upload website files to see a live preview here.</p>
        )}

        {previewUrl && (
          <div className={`wp-preview-frame wp-preview-frame--${device}`}>
            <iframe
              key={previewUrl}
              title="Website preview"
              src={previewUrl}
              sandbox="allow-scripts allow-forms allow-popups allow-modals"
            />
          </div>
        )}
      </div>
    </Card>
  )
}
