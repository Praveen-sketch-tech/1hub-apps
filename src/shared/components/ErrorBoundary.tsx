import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ServerErrorPage } from '@apps/errors/ServerErrorPage'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

// Top-level error boundary. Catches render errors anywhere in the tree and
// falls back to the 500 page instead of a blank screen.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Uncaught error:', error, info)
  }

  render() {
    if (this.state.hasError) return <ServerErrorPage />
    return this.props.children
  }
}
