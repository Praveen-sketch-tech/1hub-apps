import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { PublishStageState } from '../types'

interface ProgressPanelProps {
  stages: PublishStageState[]
  errorMessage: string | null
  commitSha: string | null
  liveUrl: string | null
  deploymentConfirmed: boolean
  onRetryDeployCheck: () => void
  retryingDeployCheck: boolean
}

function stageIcon(status: PublishStageState['status']): string {
  switch (status) {
    case 'done': return '✅'
    case 'active': return '⏳'
    case 'error': return '❌'
    default: return '·'
  }
}

export function ProgressPanel({
  stages,
  errorMessage,
  commitSha,
  liveUrl,
  deploymentConfirmed,
  onRetryDeployCheck,
  retryingDeployCheck,
}: ProgressPanelProps) {
  return (
    <Card className="tool-card">
      <div className="tool-stack">
        <h2 className="wp-section-title">Publishing</h2>

        <ol className="wp-stage-list">
          {stages.map((stage) => (
            <li key={stage.id} className={`wp-stage wp-stage--${stage.status}`}>
              <span className="wp-stage-icon">{stageIcon(stage.status)}</span>
              <span>
                {stage.label}
                {stage.detail && <span className="wp-stage-detail"> — {stage.detail}</span>}
              </span>
            </li>
          ))}
        </ol>

        {errorMessage && <p className="wp-error">{errorMessage}</p>}

        {commitSha && (
          <div className="wp-result">
            <p>✅ Commit created: <span className="wp-mono">{commitSha.slice(0, 10)}</span></p>

            {deploymentConfirmed ? (
              <p>🟢 Live and reachable.</p>
            ) : (
              <p>Published to GitHub. Vercel deployment is still processing.</p>
            )}

            {liveUrl && (
              <div className="tool-actions">
                <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(liveUrl)}>
                  Copy URL
                </Button>
                <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                  <Button type="button">Open Website</Button>
                </a>
                {!deploymentConfirmed && (
                  <Button type="button" variant="secondary" onClick={onRetryDeployCheck} loading={retryingDeployCheck}>
                    Check again
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
