import { useState } from 'react'
import { formatJson, minifyJson, validateJson } from '../lib/jsonTools'

export default function JsonPanel({
  input,
  onOutput,
}: {
  input: string
  onOutput: (value: string) => void
}) {
  const [message, setMessage] = useState('')

  const run = (action: 'format' | 'minify' | 'validate') => {
    try {
      if (action === 'validate') {
        setMessage(validateJson(input).message)
        return
      }
      onOutput(action === 'format' ? formatJson(input, 2) : minifyJson(input))
      setMessage('Done')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Invalid JSON')
    }
  }

  return (
    <div className="stt-tool-options">
      <div className="stt-actions">
        <button className="stt-primary-button" type="button" onClick={() => run('format')}>Format JSON</button>
        <button className="stt-secondary-button" type="button" onClick={() => run('minify')}>Minify</button>
        <button className="stt-secondary-button" type="button" onClick={() => run('validate')}>Validate</button>
      </div>
      {message && <div className="stt-status">{message}</div>}
    </div>
  )
}
