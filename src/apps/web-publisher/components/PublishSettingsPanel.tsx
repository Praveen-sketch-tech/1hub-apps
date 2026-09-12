import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { DestinationPlan, ProjectType } from '../types'

interface PublishSettingsPanelProps {
  slug: string
  onSlugChange: (value: string) => void
  slugError: string | null
  projectType: ProjectType | null
  htmlFiles: string[]
  needsEntrySelection: boolean
  selectedEntry: string | null
  onSelectEntry: (path: string) => void
  destination: DestinationPlan | null
  warnings: string[]
  destinationExists: boolean | null
  checkingDestination: boolean
  replaceConfirmed: boolean
  onConfirmReplace: () => void
  onCancelReplace: () => void
}

export function PublishSettingsPanel({
  slug,
  onSlugChange,
  slugError,
  projectType,
  htmlFiles,
  needsEntrySelection,
  selectedEntry,
  onSelectEntry,
  destination,
  warnings,
  destinationExists,
  checkingDestination,
  replaceConfirmed,
  onConfirmReplace,
  onCancelReplace,
}: PublishSettingsPanelProps) {
  return (
    <Card className="tool-card">
      <div className="tool-stack">
        <h2 className="wp-section-title">Publish Settings</h2>

        <div className="tool-field">
          <label className="tool-label" htmlFor="wp-slug">URL Name / Slug</label>
          <input
            id="wp-slug"
            className="tool-input"
            placeholder="api-hunter"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            spellCheck={false}
          />
          {slugError && <p className="wp-error">{slugError}</p>}
        </div>

        {needsEntrySelection && (
          <div className="tool-field">
            <label className="tool-label" htmlFor="wp-entry">
              Multiple HTML files found — choose the entry page
            </label>
            <select
              id="wp-entry"
              className="tool-select"
              value={selectedEntry ?? ''}
              onChange={(e) => onSelectEntry(e.target.value)}
            >
              <option value="">Select entry HTML file…</option>
              {htmlFiles.map((path) => (
                <option key={path} value={path}>{path}</option>
              ))}
            </select>
          </div>
        )}

        {projectType && (
          <p className="tool-muted">
            Detected project type: <strong>{projectType === 'single-html' ? 'Single HTML file' : 'Multi-file website'}</strong>
          </p>
        )}

        {destination && (
          <div className="wp-destination">
            <div>
              <span className="tool-label">Destination</span>
              <p className="wp-mono">{destination.basePath}{destination.projectType === 'multi-file' ? '/' : ''}</p>
            </div>
            <div>
              <span className="tool-label">Live URL</span>
              <p className="wp-mono">{destination.liveUrl}</p>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="wp-warning-box">
            <p className="wp-warning-title">⚠️ Warnings</p>
            <ul>
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {checkingDestination && <p className="tool-muted">Checking GitHub for an existing destination…</p>}

        {destinationExists && !replaceConfirmed && (
          <div className="wp-warning-box wp-warning-box--danger">
            <p className="wp-warning-title">This URL already exists.</p>
            <p>Publishing will only overwrite files that belong to this upload; nothing else in the repository will be touched or deleted.</p>
            <div className="tool-actions">
              <Button type="button" variant="danger" onClick={onConfirmReplace}>Replace existing files</Button>
              <Button type="button" variant="secondary" onClick={onCancelReplace}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
