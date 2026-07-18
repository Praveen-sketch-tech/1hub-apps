import { useEffect, useMemo, useRef, useState } from 'react'
import AudioDropzone from './components/AudioDropzone'
import WaveformCanvas from './components/WaveformCanvas'
import {
  audioBufferToWavBlob,
  decodeAudioFile,
  downloadBlob,
  formatDuration,
  mergeAudioBuffers,
  processAudioBuffer,
} from './lib/audioProcessing'
import { trackAudioToolEvent } from './lib/analytics'
import type { AudioItem } from './lib/types'
import './smart-audio-tools.css'

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function SmartAudioToolsPage() {
  const [items, setItems] = useState<AudioItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [volume, setVolume] = useState(1)
  const [fadeIn, setFadeIn] = useState(0)
  const [fadeOut, setFadeOut] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Add one or more audio files to begin.')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  )

  useEffect(() => {
    if (!selected) return
    setSelectedId(selected.id)
    setTrimStart(0)
    setTrimEnd(selected.duration)
  }, [selected?.id])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  useEffect(() => () => {
    items.forEach((item) => URL.revokeObjectURL(item.objectUrl))
  }, [items])

  const addFiles = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    setStatus('Decoding audio locally in your browser…')
    try {
      const decoded: AudioItem[] = []
      for (const file of files) {
        const buffer = await decodeAudioFile(file)
        decoded.push({
          id: makeId(),
          file,
          buffer,
          objectUrl: URL.createObjectURL(file),
          duration: buffer.duration,
        })
      }
      setItems((current) => [...current, ...decoded])
      setSelectedId((current) => current ?? decoded[0]?.id ?? null)
      setStatus(`${decoded.length} audio file${decoded.length === 1 ? '' : 's'} added.`)
      trackAudioToolEvent('audio_uploaded', { count: decoded.length })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not decode this audio file.')
    } finally {
      setBusy(false)
    }
  }

  const removeItem = (id: string) => {
    setItems((current) => {
      const item = current.find((entry) => entry.id === id)
      if (item) URL.revokeObjectURL(item.objectUrl)
      return current.filter((entry) => entry.id !== id)
    })
    if (selectedId === id) setSelectedId(null)
  }

  const exportSelected = () => {
    if (!selected) return
    setBusy(true)
    try {
      const processed = processAudioBuffer(selected.buffer, {
        trimStart,
        trimEnd,
        volume,
        fadeIn,
        fadeOut,
      })
      downloadBlob(audioBufferToWavBlob(processed), 'processed-audio.wav')
      setStatus('Processed WAV exported.')
      trackAudioToolEvent('audio_wav_exported')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  const mergeAll = () => {
    if (items.length < 2) return
    setBusy(true)
    try {
      const merged = mergeAudioBuffers(items.map((item) => item.buffer))
      downloadBlob(audioBufferToWavBlob(merged), 'merged-audio.wav')
      setStatus('Merged WAV exported.')
      trackAudioToolEvent('audio_merge_used', { count: items.length })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Merge failed.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    items.forEach((item) => URL.revokeObjectURL(item.objectUrl))
    setItems([])
    setSelectedId(null)
    setTrimStart(0)
    setTrimEnd(0)
    setVolume(1)
    setFadeIn(0)
    setFadeOut(0)
    setSpeed(1)
    setStatus('Workspace reset.')
    trackAudioToolEvent('audio_reset_used')
  }

  return (
    <main className="sat-page">
      <section className="sat-hero">
        <div>
          <div className="sat-kicker">APP #009</div>
          <h1>Smart Audio Tools</h1>
          <p>Trim, merge, adjust and export audio directly in your browser.</p>
        </div>
        <div className="local-processing-badge">🔒 Local processing</div>
      </section>

      <AudioDropzone disabled={busy} onFiles={addFiles} />

      {items.length > 0 && (
        <>
          <section className="sat-summary" aria-label="Audio summary">
            <div><strong>{items.length}</strong><span>Files</span></div>
            <div><strong>{formatDuration(items.reduce((sum, item) => sum + item.duration, 0))}</strong><span>Total duration</span></div>
            <div><strong>WAV</strong><span>Local export</span></div>
          </section>

          <section className="sat-card">
            <div className="sat-row-between">
              <div>
                <h2>Files</h2>
                <p>Select a file to edit, or merge all files in the current order.</p>
              </div>
              <button type="button" onClick={mergeAll} disabled={busy || items.length < 2}>Merge all → WAV</button>
            </div>
            <div className="sat-file-list">
              {items.map((item, index) => (
                <div key={item.id} className={`sat-file-row${selected?.id === item.id ? ' is-selected' : ''}`}>
                  <button type="button" className="sat-file-select" onClick={() => setSelectedId(item.id)}>
                    <span className="sat-file-index">{index + 1}</span>
                    <span className="sat-file-name">{item.file.name}</span>
                    <span className="sat-file-duration">{formatDuration(item.duration)}</span>
                  </button>
                  <button type="button" className="sat-remove" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.file.name}`}>×</button>
                </div>
              ))}
            </div>
          </section>

          {selected && (
            <section className="sat-card">
              <h2>Editor</h2>
              <p className="sat-selected-name" title={selected.file.name}>{selected.file.name}</p>
              <WaveformCanvas buffer={selected.buffer} />
              <audio ref={audioRef} className="sat-audio" controls src={selected.objectUrl} />

              <div className="sat-grid">
                <label>
                  Trim start (sec)
                  <input type="number" min="0" max={selected.duration} step="0.1" value={trimStart} onChange={(event) => setTrimStart(Number(event.target.value))} />
                </label>
                <label>
                  Trim end (sec)
                  <input type="number" min="0" max={selected.duration} step="0.1" value={trimEnd} onChange={(event) => setTrimEnd(Number(event.target.value))} />
                </label>
                <label>
                  Volume ({Math.round(volume * 100)}%)
                  <input type="range" min="0" max="2" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
                </label>
                <label>
                  Preview speed ({speed.toFixed(2)}×)
                  <input type="range" min="0.5" max="2" step="0.05" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
                </label>
                <label>
                  Fade in (sec)
                  <input type="number" min="0" max={selected.duration} step="0.1" value={fadeIn} onChange={(event) => setFadeIn(Number(event.target.value))} />
                </label>
                <label>
                  Fade out (sec)
                  <input type="number" min="0" max={selected.duration} step="0.1" value={fadeOut} onChange={(event) => setFadeOut(Number(event.target.value))} />
                </label>
              </div>

              <div className="sat-actions">
                <button type="button" className="sat-primary" onClick={exportSelected} disabled={busy}>Export processed WAV</button>
                <button type="button" onClick={reset} disabled={busy}>Reset workspace</button>
              </div>
            </section>
          )}
        </>
      )}

      <div className="sat-status" role="status">{status}</div>
    </main>
  )
}
