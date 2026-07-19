import { useMemo, useState } from 'react'
import { generatePassword, estimatePasswordStrength } from './lib/password'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import './smart-password-generator.css'

export default function SmartPasswordGeneratorPage() {
  const [length, setLength] = useState(20)
  const [uppercase, setUppercase] = useState(true)
  const [lowercase, setLowercase] = useState(true)
  const [numbers, setNumbers] = useState(true)
  const [symbols, setSymbols] = useState(true)
  const [password, setPassword] = useState(() =>
    generatePassword({
      length: 20,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
    }),
  )
  const [message, setMessage] = useState('')

  const strength = useMemo(
    () => estimatePasswordStrength(password),
    [password],
  )

  function handleGenerate() {
    try {
      const next = generatePassword({
        length,
        uppercase,
        lowercase,
        numbers,
        symbols,
      })

      setPassword(next)
      setMessage('')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not generate password.',
      )
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password)
      setMessage('Password copied to clipboard.')
    } catch {
      setMessage('Copy failed. Select and copy the password manually.')
    }
  }

  return (
    <main className="tool-page spg-page">
      <div className="spg-shell">
        <ToolAppHeader
          appNumber="011"
          title="Smart Password Generator"
          description="Generate strong, random passwords locally in your browser."
        />

        <section className="tool-panel spg-panel">
          <div className="spg-output-wrap">
            <label className="tool-label" htmlFor="generated-password">
              Generated password
            </label>

            <div className="spg-output-row">
              <input
                id="generated-password"
                className="tool-input spg-output"
                value={password}
                readOnly
                spellCheck={false}
              />

              <button
                type="button"
                className="tool-button tool-button-secondary"
                onClick={handleCopy}
              >
                Copy
              </button>
            </div>
          </div>

          <div className="spg-strength" aria-label={`Password strength: ${strength.label}`}>
            <div className="spg-strength-head">
              <span>Strength</span>
              <strong>{strength.label}</strong>
            </div>

            <div className="spg-strength-track">
              <div
                className="spg-strength-fill"
                style={{ width: `${strength.score}%` }}
              />
            </div>
          </div>

          <div className="tool-field">
            <label className="tool-label" htmlFor="password-length">
              Password length: {length}
            </label>

            <input
              id="password-length"
              type="range"
              min="4"
              max="64"
              value={length}
              onChange={(event) => setLength(Number(event.target.value))}
            />
          </div>

          <div className="spg-options tool-grid-2">
            <label className="spg-check">
              <input
                type="checkbox"
                checked={uppercase}
                onChange={(event) => setUppercase(event.target.checked)}
              />
              <span>Uppercase A–Z</span>
            </label>

            <label className="spg-check">
              <input
                type="checkbox"
                checked={lowercase}
                onChange={(event) => setLowercase(event.target.checked)}
              />
              <span>Lowercase a–z</span>
            </label>

            <label className="spg-check">
              <input
                type="checkbox"
                checked={numbers}
                onChange={(event) => setNumbers(event.target.checked)}
              />
              <span>Numbers 0–9</span>
            </label>

            <label className="spg-check">
              <input
                type="checkbox"
                checked={symbols}
                onChange={(event) => setSymbols(event.target.checked)}
              />
              <span>Symbols</span>
            </label>
          </div>

          <div className="tool-actions">
            <button
              type="button"
              className="tool-button tool-button-primary"
              onClick={handleGenerate}
            >
              Generate password
            </button>

            <button
              type="button"
              className="tool-button tool-button-secondary"
              onClick={handleCopy}
            >
              Copy password
            </button>
          </div>

          {message && (
            <p className="spg-message" role="status">
              {message}
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
