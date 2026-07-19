import { LocalProcessingBadge } from './LocalProcessingBadge'

interface ToolAppHeaderProps {
  appNumber: string
  title: string
  description: string
  localProcessing?: boolean
}

export function ToolAppHeader({
  appNumber,
  title,
  description,
  localProcessing = true,
}: ToolAppHeaderProps) {
  return (
    <header className="tool-app-header">
      <div>
        <p className="tool-app-kicker">
          1 Hub Apps · App #{appNumber}
        </p>

        <h1>{title}</h1>

        <p className="tool-app-description">
          {description}
        </p>
      </div>

      {localProcessing && <LocalProcessingBadge />}
    </header>
  )
}
