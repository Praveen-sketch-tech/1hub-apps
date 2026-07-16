import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import Cropper, {
  CropperImage,
  CropperSelection,
} from 'cropperjs'
import type { OutputFormat } from '../types'

export interface CropExportResult {
  blob: Blob
  width: number
  height: number
}

export type CropExporter = (
  format: OutputFormat,
  quality: number,
) => Promise<CropExportResult>

interface CropEditorProps {
  imageUrl: string
  onExporterReady: (exporter: CropExporter | null) => void
  onChange?: () => void
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
      initial-coverage="0.72"
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

function canvasToBlob(
  sourceCanvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  let outputCanvas = sourceCanvas

  // JPG does not support transparency, so paint a white background.
  if (format === 'image/jpeg') {
    const canvas = document.createElement('canvas')
    canvas.width = sourceCanvas.width
    canvas.height = sourceCanvas.height

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Canvas is not supported in this browser.')
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(sourceCanvas, 0, 0)
    outputCanvas = canvas
  }

  return new Promise((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Could not create the cropped image.'))
        }
      },
      format,
      format === 'image/png' ? undefined : quality,
    )
  })
}

function normalizeDegrees(value: number): number {
  let angle = value % 360

  if (angle > 180) angle -= 360
  if (angle < -180) angle += 360

  return Math.round(angle * 10) / 10
}

export default function CropEditor({
  imageUrl,
  onExporterReady,
  onChange,
}: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rotateHandleRef = useRef<HTMLButtonElement | null>(null)

  const cropperImageRef = useRef<CropperImage | null>(null)
  const selectionRef = useRef<CropperSelection | null>(null)

  const rotatingRef = useRef(false)
  const previousAngleRef = useRef(0)

  const [rotation, setRotation] = useState(0)
  const [aspect, setAspect] = useState('free')

  useEffect(() => {
    const container = containerRef.current
    const rotateHandle = rotateHandleRef.current

    if (!container || !rotateHandle) return

    container.innerHTML = ''

    const image = new Image()
    image.src = imageUrl
    image.alt = 'Crop image'

    const cropper = new Cropper(image, {
      container,
      template: CROPPER_TEMPLATE,
    })

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

      const centerX =
        selectionRect.left - stageRect.left + selectionRect.width / 2

      const top =
        selectionRect.top - stageRect.top

      rotateHandle.style.left = `${centerX}px`
      rotateHandle.style.top = `${Math.max(8, top - 34)}px`
      rotateHandle.style.opacity = selectionRect.width > 0 ? '1' : '0'
    }

    const notifyChange = () => {
      syncRotateHandle()
      onChange?.()
    }

    selection.addEventListener('change', notifyChange)
    cropperImage.addEventListener('transform', notifyChange)

    cropperImage.$ready(() => {
      cropperImage.$center('contain')
      selection.$reset()
      syncRotateHandle()
    })

    const exportCrop: CropExporter = async (format, quality) => {
      const sourceImage = cropperImage.$image

      if (!sourceImage) {
        throw new Error('Original image is not ready.')
      }

      const transform = cropperImage.$getTransform()

      const scaleX = Math.hypot(transform[0], transform[1])
      const scaleY = Math.hypot(transform[2], transform[3])

      const renderedRect = cropperImage.getBoundingClientRect()
      const naturalWidth = sourceImage.naturalWidth
      const naturalHeight = sourceImage.naturalHeight

      const sourceScaleX =
        renderedRect.width > 0
          ? naturalWidth / renderedRect.width
          : scaleX > 0
            ? 1 / scaleX
            : 1

      const sourceScaleY =
        renderedRect.height > 0
          ? naturalHeight / renderedRect.height
          : scaleY > 0
            ? 1 / scaleY
            : sourceScaleX

      const outputWidth = Math.min(
        16384,
        Math.max(
          1,
          Math.round(selection.width * sourceScaleX),
        ),
      )

      const outputHeight = Math.min(
        16384,
        Math.max(
          1,
          Math.round(selection.height * sourceScaleY),
        ),
      )

      const canvas = await selection.$toCanvas({
        width: outputWidth,
        height: outputHeight,
        beforeDraw(context) {
          context.imageSmoothingEnabled = true
          context.imageSmoothingQuality = 'high'
        },
      })

      if (!canvas.width || !canvas.height) {
        throw new Error('Please create a valid crop selection.')
      }

      const exportQuality =
        format === 'image/png'
          ? 1
          : Math.max(0.97, quality)

      const blob = await canvasToBlob(
        canvas,
        format,
        exportQuality,
      )

      return {
        blob,
        width: canvas.width,
        height: canvas.height,
      }
    }
    onExporterReady(exportCrop)

    const resizeObserver = new ResizeObserver(syncRotateHandle)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      selection.removeEventListener('change', notifyChange)
      cropperImage.removeEventListener('transform', notifyChange)

      cropperImageRef.current = null
      selectionRef.current = null
      onExporterReady(null)
      container.innerHTML = ''
    }
  }, [imageUrl, onChange, onExporterReady])

  const beginRotation = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    const selection = selectionRef.current

    if (!selection) return

    const rect = selection.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    previousAngleRef.current = Math.atan2(
      event.clientY - centerY,
      event.clientX - centerX,
    )

    rotatingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)

    event.preventDefault()
    event.stopPropagation()
  }

  const rotateImage = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    if (!rotatingRef.current) return

    const selection = selectionRef.current
    const cropperImage = cropperImageRef.current

    if (!selection || !cropperImage) return

    const rect = selection.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const currentAngle = Math.atan2(
      event.clientY - centerY,
      event.clientX - centerX,
    )

    const deltaRadians =
      currentAngle - previousAngleRef.current

    const deltaDegrees =
      deltaRadians * (180 / Math.PI)

    previousAngleRef.current = currentAngle

    cropperImage.$rotate(
      `${deltaDegrees}deg`,
      selection.x + selection.width / 2,
      selection.y + selection.height / 2,
    )

    setRotation((current) =>
      normalizeDegrees(current + deltaDegrees),
    )

    onChange?.()

    event.preventDefault()
    event.stopPropagation()
  }

  const stopRotation = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
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
    onChange?.()
  }

  const changeAspectRatio = (value: string): void => {
    setAspect(value)

    const selection = selectionRef.current

    if (!selection) return

    const ratio =
      value === 'free'
        ? Number.NaN
        : Number(value)

    selection.aspectRatio = ratio

    selection.$change(
      selection.x,
      selection.y,
      selection.width,
      selection.height,
      ratio,
    )

    onChange?.()
  }

  const handleWheel = (
    event: React.WheelEvent<HTMLDivElement>,
  ): void => {
    const cropperImage = cropperImageRef.current

    if (!cropperImage) return

    event.preventDefault()

    cropperImage.$zoom(
      event.deltaY < 0 ? 0.08 : -0.08,
      event.nativeEvent.offsetX,
      event.nativeEvent.offsetY,
    )

    onChange?.()
  }

  return (
    <div className="sit-crop-section">
      <div
        className="sit-crop-stage sit-cropper-v2"
        onWheel={handleWheel}
      >
        <div
          ref={containerRef}
          className="sit-cropper-container"
        />

        <button
          ref={rotateHandleRef}
          className="sit-crop-rotate-handle"
          type="button"
          title="Drag to rotate image"
          aria-label="Drag to rotate image"
          onPointerDown={beginRotation}
          onPointerMove={rotateImage}
          onPointerUp={stopRotation}
          onPointerCancel={stopRotation}
          onDoubleClick={resetRotation}
        >
          <span className="sit-rotate-line" />
          <span className="sit-rotate-circle">↻</span>
        </button>

        <div className="sit-rotation-badge">
          {rotation > 0 ? '+' : ''}
          {rotation.toFixed(1)}°
        </div>
      </div>

      <p className="sit-crop-hint">
        Box ke andar drag karke move karo · corners ya sides se
        resize karo · upar wale round handle ko drag karke rotate
        karo · mouse wheel se image zoom karo
      </p>

      <div className="sit-crop-controls">
        <label>
          Crop ratio
          <select
            value={aspect}
            onChange={(event) =>
              changeAspectRatio(event.target.value)
            }
          >
            <option value="free">Free</option>
            <option value={1}>1:1</option>
            <option value={4 / 3}>4:3</option>
            <option value={16 / 9}>16:9</option>
            <option value={3 / 4}>3:4</option>
            <option value={9 / 16}>9:16</option>
          </select>
        </label>

        <button
          type="button"
          className="sit-secondary-button"
          onClick={resetRotation}
        >
          Reset rotation
        </button>
      </div>
    </div>
  )
}
