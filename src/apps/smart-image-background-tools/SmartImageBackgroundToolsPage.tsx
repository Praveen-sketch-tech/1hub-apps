import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { ToolAppHeader } from '../../shared/components/tools/ToolAppHeader'
import {
  createBackgroundOutputName,
  createColorMask,
  createOpaqueMask,
  estimateCornerBackground,
  exportComposite,
  hexToRgb,
  loadImageFile,
  renderComposite,
  rgbToHex,
  sampleColor,
  type BackgroundMode,
  type LoadedImage,
  type OutputFormat,
} from './lib/backgroundProcessing'
import './smart-image-background-tools.css'

type EditorTool = 'pick' | 'erase' | 'restore'
type Point = { x: number; y: number }

const MAX_HISTORY = 12

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1200)
}

function eventPoint(
  event: ReactPointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
): Point {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  }
}

function paintMaskCircle(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  point: Point,
  radius: number,
  tool: 'erase' | 'restore',
) {
  const left = Math.max(0, Math.floor(point.x - radius))
  const right = Math.min(width - 1, Math.ceil(point.x + radius))
  const top = Math.max(0, Math.floor(point.y - radius))
  const bottom = Math.min(height - 1, Math.ceil(point.y + radius))
  const softStart = radius * 0.72

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const distance = Math.hypot(x - point.x, y - point.y)
      if (distance > radius) continue

      const strength = distance <= softStart
        ? 1
        : 1 - (distance - softStart) / Math.max(1, radius - softStart)
      const index = y * width + x
      const target = tool === 'erase' ? 0 : 255
      mask[index] = Math.round(mask[index] + (target - mask[index]) * strength)
    }
  }
}

function paintMaskLine(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  from: Point,
  to: Point,
  radius: number,
  tool: 'erase' | 'restore',
) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.22)))

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps
    paintMaskCircle(
      mask,
      width,
      height,
      {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      },
      radius,
      tool,
    )
  }
}

export default function SmartImageBackgroundToolsPage() {
  const [fileName, setFileName] = useState('image.png')
  const [loaded, setLoaded] = useState<LoadedImage | null>(null)
  const [targetColor, setTargetColor] = useState('#FFFFFF')
  const [tolerance, setTolerance] = useState(20)
  const [feather, setFeather] = useState(8)
  const [editorTool, setEditorTool] = useState<EditorTool>('pick')
  const [brushSize, setBrushSize] = useState(42)
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('transparent')
  const [customColor, setCustomColor] = useState('#F3F4F6')
  const [blurRadius, setBlurRadius] = useState(18)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/png')
  const [quality, setQuality] = useState(92)
  const [status, setStatus] = useState('Upload an image to start. Everything runs locally in your browser.')
  const [busy, setBusy] = useState(false)
  const [maskVersion, setMaskVersion] = useState(0)
  const [historyIndex, setHistoryIndex] = useState(0)
  const [historyLength, setHistoryLength] = useState(0)

  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const afterCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const maskRef = useRef<Uint8ClampedArray | null>(null)
  const historyRef = useRef<Uint8ClampedArray[]>([])
  const pointerDownRef = useRef(false)
  const lastPointRef = useRef<Point | null>(null)
  const brushChangedRef = useRef(false)
  const renderFrameRef = useRef<number | null>(null)

  const composeOptions = {
    backgroundMode,
    customColor,
    blurRadius,
    outputFormat,
    quality: quality / 100,
  }

  const renderEditor = useCallback(() => {
    if (!loaded || !sourceCanvasRef.current || !maskRef.current) return

    const beforeCanvas = beforeCanvasRef.current
    if (beforeCanvas) {
      beforeCanvas.width = sourceCanvasRef.current.width
      beforeCanvas.height = sourceCanvasRef.current.height
      const beforeContext = beforeCanvas.getContext('2d')
      beforeContext?.clearRect(0, 0, beforeCanvas.width, beforeCanvas.height)
      beforeContext?.drawImage(sourceCanvasRef.current, 0, 0)
    }

    const afterCanvas = afterCanvasRef.current
    if (afterCanvas) {
      renderComposite(
        afterCanvas,
        sourceCanvasRef.current,
        loaded.imageData,
        maskRef.current,
        composeOptions,
      )
    }
  }, [loaded, backgroundMode, customColor, blurRadius, outputFormat, quality])

  useEffect(() => {
    renderEditor()
  }, [renderEditor, maskVersion])

  useEffect(() => () => {
    if (renderFrameRef.current !== null) {
      cancelAnimationFrame(renderFrameRef.current)
    }
  }, [])

  const scheduleMaskRender = () => {
    if (renderFrameRef.current !== null) return
    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null
      setMaskVersion((value) => value + 1)
    })
  }

  const syncHistoryState = (index: number, length: number) => {
    setHistoryIndex(index)
    setHistoryLength(length)
  }

  const resetHistory = (mask: Uint8ClampedArray) => {
    const first = mask.slice()
    historyRef.current = [first]
    maskRef.current = first.slice()
    syncHistoryState(0, 1)
    setMaskVersion((value) => value + 1)
  }

  const commitMask = (mask: Uint8ClampedArray) => {
    const next = mask.slice()
    const currentIndex = historyIndex
    let nextHistory = historyRef.current.slice(0, currentIndex + 1)
    nextHistory.push(next)
    if (nextHistory.length > MAX_HISTORY) nextHistory = nextHistory.slice(-MAX_HISTORY)
    historyRef.current = nextHistory
    const nextIndex = nextHistory.length - 1
    maskRef.current = next.slice()
    syncHistoryState(nextIndex, nextHistory.length)
    setMaskVersion((value) => value + 1)
  }

  const recordCurrentBrushMask = () => {
    if (!maskRef.current || !brushChangedRef.current) return
    commitMask(maskRef.current)
    brushChangedRef.current = false
  }

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBusy(true)
    setStatus('Loading image locally…')

    try {
      const nextLoaded = await loadImageFile(file)
      setLoaded(nextLoaded)
      setFileName(file.name)
      sourceCanvasRef.current = nextLoaded.canvas

      const estimated = estimateCornerBackground(nextLoaded.imageData)
      setTargetColor(rgbToHex(estimated))
      const initialMask = createColorMask(nextLoaded.imageData, {
        targetColor: estimated,
        tolerance,
        feather,
      })
      resetHistory(initialMask)
      setEditorTool('pick')
      setStatus(
        `Loaded ${nextLoaded.canvas.width}×${nextLoaded.canvas.height}px. Corner color estimated and removed.${nextLoaded.scaled ? ` Original ${nextLoaded.originalWidth}×${nextLoaded.originalHeight}px was scaled to a browser-safe working size.` : ''}`,
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The image could not be loaded.')
    } finally {
      setBusy(false)
    }
  }

  const applyColorRemoval = (hex = targetColor) => {
    if (!loaded) return
    const nextMask = createColorMask(loaded.imageData, {
      targetColor: hexToRgb(hex),
      tolerance,
      feather,
    })
    commitMask(nextMask)
    setStatus(`Removed pixels near ${hex.toUpperCase()} using tolerance ${tolerance} and feather ${feather}.`)
  }

  const useCornerColor = () => {
    if (!loaded) return
    const estimated = estimateCornerBackground(loaded.imageData)
    const hex = rgbToHex(estimated)
    setTargetColor(hex)
    applyColorRemoval(hex)
  }

  const resetMask = () => {
    if (!loaded) return
    resetHistory(createOpaqueMask(loaded.imageData))
    setStatus('Background mask reset. The full image is visible again.')
  }

  const undo = () => {
    if (historyIndex <= 0) return
    const nextIndex = historyIndex - 1
    maskRef.current = historyRef.current[nextIndex].slice()
    syncHistoryState(nextIndex, historyRef.current.length)
    setMaskVersion((value) => value + 1)
    setStatus('Undo applied.')
  }

  const redo = () => {
    if (historyIndex >= historyLength - 1) return
    const nextIndex = historyIndex + 1
    maskRef.current = historyRef.current[nextIndex].slice()
    syncHistoryState(nextIndex, historyRef.current.length)
    setMaskVersion((value) => value + 1)
    setStatus('Redo applied.')
  }

  const pickAtPoint = (point: Point) => {
    if (!loaded) return
    const sampled = sampleColor(loaded.imageData, point.x, point.y)
    const hex = rgbToHex(sampled)
    setTargetColor(hex)
    const nextMask = createColorMask(loaded.imageData, {
      targetColor: sampled,
      tolerance,
      feather,
    })
    commitMask(nextMask)
    setStatus(`Picked ${hex} from the image and applied color-based removal.`)
  }

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!loaded || !maskRef.current) return
    const canvas = event.currentTarget
    const point = eventPoint(event, canvas)

    if (editorTool === 'pick') {
      pickAtPoint(point)
      return
    }

    event.preventDefault()
    canvas.setPointerCapture(event.pointerId)
    pointerDownRef.current = true
    lastPointRef.current = point
    brushChangedRef.current = true
    paintMaskCircle(
      maskRef.current,
      loaded.imageData.width,
      loaded.imageData.height,
      point,
      brushSize / 2,
      editorTool,
    )
    scheduleMaskRender()
  }

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pointerDownRef.current || !loaded || !maskRef.current || editorTool === 'pick') return
    event.preventDefault()
    const point = eventPoint(event, event.currentTarget)
    const lastPoint = lastPointRef.current ?? point
    paintMaskLine(
      maskRef.current,
      loaded.imageData.width,
      loaded.imageData.height,
      lastPoint,
      point,
      brushSize / 2,
      editorTool,
    )
    lastPointRef.current = point
    scheduleMaskRender()
  }

  const finishBrush = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pointerDownRef.current) return
    pointerDownRef.current = false
    lastPointRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    recordCurrentBrushMask()
    setStatus(editorTool === 'erase' ? 'Manual erase applied.' : 'Manual restore applied.')
  }

  const onBeforePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!loaded) return
    pickAtPoint(eventPoint(event, event.currentTarget))
    setEditorTool('pick')
  }

  const exportImage = async () => {
    if (!loaded || !sourceCanvasRef.current || !maskRef.current) return
    setBusy(true)
    setStatus('Rendering export locally…')

    try {
      const blob = await exportComposite(
        sourceCanvasRef.current,
        loaded.imageData,
        maskRef.current,
        composeOptions,
      )
      const outputName = createBackgroundOutputName(fileName, outputFormat)
      saveBlob(blob, outputName)
      const jpegNote = outputFormat === 'image/jpeg' && backgroundMode === 'transparent'
        ? ' JPEG cannot store transparency, so white was used.'
        : ''
      setStatus(`Exported ${outputName} (${(blob.size / 1024).toFixed(1)} KB).${jpegNote}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  const formatLabel = outputFormat === 'image/jpeg' ? 'JPG' : outputFormat.split('/')[1].toUpperCase()

  return (
    <main className="tool-page sibg-page">
      <ToolAppHeader
        appNumber="029"
        title="Smart Image Background Tools"
        description="Remove flat or mostly uniform image backgrounds with real browser-local color controls, refine the mask manually, and export the result without claiming AI subject detection."
      />

      <section className="tool-card sibg-truth-note" aria-label="Capability note">
        <strong>Color-based removal, not AI:</strong>
        <span>This works best with plain, studio, green-screen, white, or other mostly uniform backgrounds. Hair and similarly colored foreground details may need brush correction.</span>
      </section>

      <section className="sibg-workspace">
        <aside className="tool-panel sibg-controls">
          <div className="sibg-control-section">
            <h2>1. Upload</h2>
            <label className="sibg-dropzone">
              <input type="file" accept="image/*" onChange={onUpload} disabled={busy} />
              <strong>{loaded ? 'Choose another image' : 'Choose an image'}</strong>
              <span>PNG, JPG, WebP and browser-supported image formats</span>
            </label>
          </div>

          <div className="sibg-control-section">
            <h2>2. Remove by color</h2>
            <div className="sibg-tool-row" role="group" aria-label="Editor tool">
              {(['pick', 'erase', 'restore'] as EditorTool[]).map((tool) => (
                <button
                  key={tool}
                  type="button"
                  className={`tool-button ${editorTool === tool ? 'sibg-active-tool' : ''}`}
                  onClick={() => setEditorTool(tool)}
                  disabled={!loaded}
                >
                  {tool === 'pick' ? 'Pick color' : tool === 'erase' ? 'Erase' : 'Restore'}
                </button>
              ))}
            </div>

            <div className="sibg-color-row">
              <input
                className="sibg-color-picker"
                type="color"
                value={targetColor}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setTargetColor(event.target.value.toUpperCase())}
                aria-label="Background color"
                disabled={!loaded}
              />
              <input
                className="tool-input"
                value={targetColor}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setTargetColor(event.target.value)}
                aria-label="Background color hex"
                disabled={!loaded}
              />
            </div>

            <label className="tool-field">
              <span className="tool-label">Tolerance: {tolerance}</span>
              <input type="range" min="0" max="100" value={tolerance} onChange={(event: ChangeEvent<HTMLInputElement>) => setTolerance(Number(event.target.value))} disabled={!loaded} />
            </label>

            <label className="tool-field">
              <span className="tool-label">Edge feather: {feather}</span>
              <input type="range" min="0" max="100" value={feather} onChange={(event: ChangeEvent<HTMLInputElement>) => setFeather(Number(event.target.value))} disabled={!loaded} />
            </label>

            <div className="sibg-button-grid">
              <button className="tool-button tool-button-primary" type="button" onClick={() => applyColorRemoval()} disabled={!loaded}>Apply color removal</button>
              <button className="tool-button" type="button" onClick={useCornerColor} disabled={!loaded}>Use corner color</button>
            </div>

            <label className="tool-field">
              <span className="tool-label">Brush size: {brushSize}px</span>
              <input type="range" min="8" max="180" value={brushSize} onChange={(event: ChangeEvent<HTMLInputElement>) => setBrushSize(Number(event.target.value))} disabled={!loaded} />
            </label>

            <div className="sibg-history-row">
              <button className="tool-button" type="button" onClick={undo} disabled={historyIndex <= 0}>Undo</button>
              <button className="tool-button" type="button" onClick={redo} disabled={historyLength === 0 || historyIndex >= historyLength - 1}>Redo</button>
              <button className="tool-button" type="button" onClick={resetMask} disabled={!loaded}>Reset mask</button>
            </div>
          </div>

          <div className="sibg-control-section">
            <h2>3. Background</h2>
            <div className="sibg-background-options">
              {([
                ['transparent', 'Transparent'],
                ['white', 'White'],
                ['custom', 'Custom'],
                ['blur', 'Blurred'],
              ] as Array<[BackgroundMode, string]>).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`tool-button ${backgroundMode === mode ? 'sibg-active-tool' : ''}`}
                  onClick={() => setBackgroundMode(mode)}
                  disabled={!loaded}
                >
                  {label}
                </button>
              ))}
            </div>

            {backgroundMode === 'custom' && (
              <label className="tool-field">
                <span className="tool-label">Custom background color</span>
                <input className="sibg-wide-color" type="color" value={customColor} onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomColor(event.target.value.toUpperCase())} />
              </label>
            )}

            {backgroundMode === 'blur' && (
              <label className="tool-field">
                <span className="tool-label">Blur strength: {blurRadius}px</span>
                <input type="range" min="1" max="48" value={blurRadius} onChange={(event: ChangeEvent<HTMLInputElement>) => setBlurRadius(Number(event.target.value))} />
              </label>
            )}
          </div>

          <div className="sibg-control-section">
            <h2>4. Export</h2>
            <label className="tool-field">
              <span className="tool-label">Format</span>
              <select className="tool-select" value={outputFormat} onChange={(event: ChangeEvent<HTMLSelectElement>) => setOutputFormat(event.target.value as OutputFormat)} disabled={!loaded}>
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPG</option>
                <option value="image/webp">WebP</option>
              </select>
            </label>

            {outputFormat !== 'image/png' && (
              <label className="tool-field">
                <span className="tool-label">Quality: {quality}%</span>
                <input type="range" min="20" max="100" value={quality} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuality(Number(event.target.value))} disabled={!loaded} />
              </label>
            )}

            {outputFormat === 'image/jpeg' && backgroundMode === 'transparent' && (
              <p className="sibg-inline-note">JPG does not support transparency. Export will use white behind the subject.</p>
            )}

            <button className="tool-button tool-button-primary sibg-export-button" type="button" onClick={exportImage} disabled={!loaded || busy}>
              {busy ? 'Processing…' : `Export ${formatLabel}`}
            </button>
          </div>
        </aside>

        <section className="sibg-editor-column">
          <div className="tool-card sibg-status" role="status">{status}</div>

          <div className="sibg-preview-grid">
            <article className="tool-card sibg-preview-card">
              <div className="sibg-preview-heading">
                <h2>Before</h2>
                <span>{loaded ? `${loaded.canvas.width}×${loaded.canvas.height}px` : 'No image'}</span>
              </div>
              <div className="sibg-canvas-stage">
                {loaded ? (
                  <canvas
                    ref={beforeCanvasRef}
                    className="sibg-preview-canvas sibg-pick-canvas"
                    onPointerDown={onBeforePointerDown}
                    aria-label="Original image. Tap to pick a background color."
                  />
                ) : (
                  <div className="sibg-empty-state">Upload an image to see the original preview.</div>
                )}
              </div>
            </article>

            <article className="tool-card sibg-preview-card">
              <div className="sibg-preview-heading">
                <h2>After</h2>
                <span>{editorTool === 'pick' ? 'Tap to pick color' : `${editorTool} brush`}</span>
              </div>
              <div className="sibg-canvas-stage sibg-checkerboard">
                {loaded ? (
                  <canvas
                    ref={afterCanvasRef}
                    className={`sibg-preview-canvas sibg-editor-canvas sibg-tool-${editorTool}`}
                    onPointerDown={onCanvasPointerDown}
                    onPointerMove={onCanvasPointerMove}
                    onPointerUp={finishBrush}
                    onPointerCancel={finishBrush}
                    aria-label="Processed image editor"
                  />
                ) : (
                  <div className="sibg-empty-state">The processed preview will appear here.</div>
                )}
              </div>
            </article>
          </div>

          <section className="tool-card sibg-help">
            <h2>Best result workflow</h2>
            <ol>
              <li>Tap a clean background area in Before or After.</li>
              <li>Increase tolerance slowly until most background disappears.</li>
              <li>Use Restore where the subject was removed, and Erase for leftover background.</li>
              <li>Choose transparent, solid, or blurred output and export.</li>
            </ol>
          </section>
        </section>
      </section>
    </main>
  )
}
