import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import Cropper, {
  type CropperImage,
  type CropperSelection,
} from 'cropperjs'

export interface CropExportResult {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

export type CropExporter = () => Promise<CropExportResult>

interface PresetCropEditorProps {
  imageUrl: string
  aspectRatio: number | null // null = free crop
  onExporterReady: (exporter: CropExporter | null) => void
}

const CROPPER_TEMPLATE = `
  <cropper-canvas background>
    <cropper-image
      rotatable
      scalable
      translatable
    ></cropper-image>

    <cropper-shade hidden></cropper-shade>

    <cropper-handle
      action="move"
      plain
    ></cropper-handle>

    <cropper-selection
      initial-coverage="0.85"
      movable
      resizable
      outlined
    >
      <cropper-grid
        role="grid"
        bordered
        covered
      ></cropper-grid>

      <cropper-crosshair centered></cropper-crosshair>

      <cropper-handle
        action="move"
        theme-color="rgba(255,255,255,.25)"
      ></cropper-handle>

      <cropper-handle action="n-resize"></cropper-handle>
      <cropper-handle action="e-resize"></cropper-handle>
      <cropper-handle action="s-resize"></cropper-handle>
      <cropper-handle action="w-resize"></cropper-handle>
      <cropper-handle action="ne-resize"></cropper-handle>
      <cropper-handle action="nw-resize"></cropper-handle>
      <cropper-handle action="se-resize"></cropper-handle>
      <cropper-handle action="sw-resize"></cropper-handle>
    </cropper-selection>
  </cropper-canvas>
`

function normalizeDegrees(value: number): number {
  let angle = value % 360
  if (angle > 180) angle -= 360
  if (angle < -180) angle += 360
  return Math.round(angle * 10) / 10
}

export function PresetCropEditor({ imageUrl, aspectRatio, onExporterReady }: PresetCropEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rotateHandleRef = useRef<HTMLButtonElement | null>(null)
  const cropperImageRef = useRef<CropperImage | null>(null)
  const selectionRef = useRef<CropperSelection | null>(null)
  const rotatingRef = useRef(false)
  const previousAngleRef = useRef(0)
  const [rotation, setRotation] = useState(0)

  // (Re)create the cropper whenever the image changes.
  useEffect(() => {
    const container = containerRef.current
    const rotateHandle = rotateHandleRef.current
    if (!container || !rotateHandle) return

    container.innerHTML = ''

    const image = new Image()
    image.src = imageUrl
    image.alt = 'Crop image'

    const cropper = new Cropper(image, { container, template: CROPPER_TEMPLATE })
    const cropperImage = cropper.getCropperImage()
    const selection = cropper.getCropperSelection()

    if (!cropperImage || !selection) {
      onExporterReady(null)
      return
    }

    cropperImageRef.current = cropperImage
    selectionRef.current = selection

    const syncRotateHandle = () => {
      const stageRect = container.getBoundingClientRect()
      const selectionRect = selection.getBoundingClientRect()
      const centerX = selectionRect.left - stageRect.left + selectionRect.width / 2
      const top = selectionRect.top - stageRect.top
      rotateHandle.style.left = `${centerX}px`
      rotateHandle.style.top = `${Math.max(8, top - 34)}px`
      rotateHandle.style.opacity = selectionRect.width > 0 ? '1' : '0'
    }

    selection.addEventListener('change', syncRotateHandle)
    cropperImage.addEventListener('transform', syncRotateHandle)

    cropperImage.$ready(() => {
      cropperImage.$center('contain')
      selection.aspectRatio = aspectRatio ?? Number.NaN
      selection.$reset()
      syncRotateHandle()
    })

    const exportCrop: CropExporter = async () => {
      const canvas = await selection.$toCanvas({
        beforeDraw(context) {
          context.imageSmoothingEnabled = true
          context.imageSmoothingQuality = 'high'
        },
      })
      if (!canvas.width || !canvas.height) {
        throw new Error('Crop area khaali hai, dobara try karo.')
      }
      return { canvas, width: canvas.width, height: canvas.height }
    }
    onExporterReady(exportCrop)

    const resizeObserver = new ResizeObserver(syncRotateHandle)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      selection.removeEventListener('change', syncRotateHandle)
      cropperImage.removeEventListener('transform', syncRotateHandle)
      cropperImageRef.current = null
      selectionRef.current = null
      onExporterReady(null)
      container.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl])

  // Update the locked ratio in place when the preset changes, without rebuilding the cropper.
  useEffect(() => {
    const selection = selectionRef.current
    if (!selection) return
    const ratio = aspectRatio ?? Number.NaN
    selection.aspectRatio = ratio
    selection.$change(selection.x, selection.y, selection.width, selection.height, ratio)
  }, [aspectRatio])

  const beginRotation = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const selection = selectionRef.current
    if (!selection) return
    const rect = selection.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    previousAngleRef.current = Math.atan2(event.clientY - centerY, event.clientX - centerX)
    rotatingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }

  const rotateImage = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (!rotatingRef.current) return
    const selection = selectionRef.current
    const cropperImage = cropperImageRef.current
    if (!selection || !cropperImage) return
    const rect = selection.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const currentAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX)
    const deltaDegrees = (currentAngle - previousAngleRef.current) * (180 / Math.PI)
    previousAngleRef.current = currentAngle
    cropperImage.$rotate(`${deltaDegrees}deg`, selection.x + selection.width / 2, selection.y + selection.height / 2)
    setRotation((current) => normalizeDegrees(current + deltaDegrees))
    event.preventDefault()
    event.stopPropagation()
  }

  const stopRotation = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (!rotatingRef.current) return
    rotatingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    event.preventDefault()
    event.stopPropagation()
  }

  const resetRotation = (): void => {
    const cropperImage = cropperImageRef.current
    if (!cropperImage) return
    cropperImage.$resetTransform()
    cropperImage.$center('contain')
    setRotation(0)
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>): void => {
    const cropperImage = cropperImageRef.current
    if (!cropperImage) return
    event.preventDefault()
    cropperImage.$zoom(event.deltaY < 0 ? 0.08 : -0.08, event.nativeEvent.offsetX, event.nativeEvent.offsetY)
  }

  return (
    <div className="psr-crop-section">
      <div className="psr-crop-stage" onWheel={handleWheel}>
        <div ref={containerRef} className="psr-cropper-container" />
        <button
          ref={rotateHandleRef}
          className="psr-crop-rotate-handle"
          type="button"
          title="Drag to rotate image"
          aria-label="Drag to rotate image"
          onPointerDown={beginRotation}
          onPointerMove={rotateImage}
          onPointerUp={stopRotation}
          onPointerCancel={stopRotation}
          onDoubleClick={resetRotation}
        >
          <span className="psr-rotate-line" />
          <span className="psr-rotate-circle">↻</span>
        </button>
        <div className="psr-rotation-badge">{rotation > 0 ? '+' : ''}{rotation.toFixed(1)}°</div>
      </div>

      <p className="psr-crop-hint">
        Corners/sides ko drag karke crop area adjust karo · beech mein drag karke move karo · upar wale round handle se rotate karo
      </p>

      <button type="button" className="psr-secondary-button" onClick={resetRotation}>
        Reset rotation
      </button>
    </div>
  )
}
