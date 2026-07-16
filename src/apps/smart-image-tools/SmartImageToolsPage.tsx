import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import CropEditor, {
  type CropExporter,
} from './components/CropEditor'
import ImageDropzone, {
  validateImageFile,
} from './components/ImageDropzone'
import { trackSmartImageEvent } from './lib/analytics'
import {
  createOutputFileName,
  formatBytes,
  loadImage,
  processImage,
} from './lib/imageProcessing'
import {
  autoCorrectAndEnhance,
} from './lib/preprocessImage'
import type {
  ImageMeta,
  OutputFormat,
  ProcessedImage,
  ResizeSettings,
  ToolMode,
} from './types'
import './smart-image-tools.css'

const toolLabels: Record<ToolMode, string> = {
  compress: 'Compress',
  resize: 'Resize',
  convert: 'Convert',
  crop: 'Crop',
}

export default function SmartImageToolsPage() {
  const [sourceFile, setSourceFile] =
    useState<File | null>(null)

  const [sourceUrl, setSourceUrl] =
    useState('')

  const [meta, setMeta] =
    useState<ImageMeta | null>(null)

  const [mode, setMode] =
    useState<ToolMode>('crop')

  const [quality, setQuality] =
    useState(0.9)

  const [format, setFormat] =
    useState<OutputFormat>('image/webp')

  const [resize, setResize] =
    useState<ResizeSettings>({
      width: 0,
      height: 0,
      lockAspectRatio: true,
    })

  const [processed, setProcessed] =
    useState<ProcessedImage | null>(null)

  const [error, setError] =
    useState('')

  const [isProcessing, setIsProcessing] =
    useState(false)

  const [isPrepared, setIsPrepared] =
    useState(false)

  const [preparationStatus, setPreparationStatus] =
    useState('Adjust crop and rotation, then continue.')

  const cropExporterRef =
    useRef<CropExporter | null>(null)

  const compressionSaving = useMemo(() => {
    if (!sourceFile || !processed) return null

    return Math.round(
      (1 - processed.blob.size / sourceFile.size) *
        100,
    )
  }, [processed, sourceFile])

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl)
      }
    }
  }, [sourceUrl])

  useEffect(() => {
    return () => {
      if (processed?.url) {
        URL.revokeObjectURL(processed.url)
      }
    }
  }, [processed?.url])

  const resetProcessed = useCallback((): void => {
    setProcessed(null)
  }, [])

  const registerCropExporter = useCallback(
    (exporter: CropExporter | null): void => {
      cropExporterRef.current = exporter
    },
    [],
  )

  const updateWorkingImage = async (
    blob: Blob,
    fileName: string,
    mimeType: string,
  ): Promise<void> => {
    const nextUrl = URL.createObjectURL(blob)

    try {
      const image = await loadImage(nextUrl)

      const nextFile = new File(
        [blob],
        fileName,
        {
          type: mimeType,
          lastModified: Date.now(),
        },
      )

      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl)
      }

      setSourceFile(nextFile)
      setSourceUrl(nextUrl)

      setMeta({
        name: nextFile.name,
        type: mimeType,
        size: blob.size,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })

      setResize({
        width: image.naturalWidth,
        height: image.naturalHeight,
        lockAspectRatio: true,
      })
    } catch (updateError) {
      URL.revokeObjectURL(nextUrl)
      throw updateError
    }
  }

  const clearSource = (): void => {
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl)
    }

    setSourceFile(null)
    setSourceUrl('')
    setMeta(null)
    setIsPrepared(false)
    setMode('crop')
    setError('')
    setPreparationStatus(
      'Adjust crop and rotation, then continue.',
    )

    cropExporterRef.current = null
    resetProcessed()
  }

  const selectFile = async (
    file: File,
  ): Promise<void> => {
    setError('')

    const validationError =
      validateImageFile(file)

    if (validationError) {
      setError(validationError)
      return
    }

    const nextUrl =
      URL.createObjectURL(file)

    try {
      const image =
        await loadImage(nextUrl)

      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl)
      }

      resetProcessed()

      setSourceFile(file)
      setSourceUrl(nextUrl)

      setMeta({
        name: file.name,
        type: file.type,
        size: file.size,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })

      setResize({
        width: image.naturalWidth,
        height: image.naturalHeight,
        lockAspectRatio: true,
      })

      setFormat(
        file.type === 'image/png'
          ? 'image/png'
          : file.type === 'image/webp'
            ? 'image/webp'
            : 'image/jpeg',
      )

      setMode('crop')
      setIsPrepared(false)

      setPreparationStatus(
        'Auto crop ready. Adjust crop box or rotation if needed.',
      )

      cropExporterRef.current = null

      trackSmartImageEvent(
        'image_uploaded',
        {
          type: file.type,
          size: file.size,
          width: image.naturalWidth,
          height: image.naturalHeight,
        },
      )
    } catch (loadError) {
      URL.revokeObjectURL(nextUrl)

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load image.',
      )
    }
  }

  const confirmCropAndPrepare =
    async (): Promise<void> => {
      if (
        !sourceFile ||
        !sourceUrl ||
        !cropExporterRef.current
      ) {
        setError(
          'Crop editor is still loading. Please try again.',
        )
        return
      }

      setIsProcessing(true)
      setError('')

      try {
        setPreparationStatus(
          'Applying crop and rotation…',
        )

        const cropped =
          await cropExporterRef.current(
            format,
            0.98,
          )

        trackSmartImageEvent(
          'crop_used',
          {
            width: cropped.width,
            height: cropped.height,
            output_size: cropped.blob.size,
          },
        )

        setPreparationStatus(
          'Auto correcting brightness and colours…',
        )

        const enhanced =
          await autoCorrectAndEnhance(
            cropped.blob,
            format,
          )

        setPreparationStatus(
          'Applying local image enhancement…',
        )

        const extension =
          format === 'image/png'
            ? 'png'
            : format === 'image/webp'
              ? 'webp'
              : 'jpg'

        const baseName =
          sourceFile.name.replace(
            /\.[^/.]+$/,
            '',
          )

        await updateWorkingImage(
          enhanced.blob,
          `${baseName}-fixed.${extension}`,
          format,
        )

        setIsPrepared(true)
        setMode('compress')

        setPreparationStatus(
          'Crop fixed, auto corrected and enhanced.',
        )

        resetProcessed()
      } catch (prepareError) {
        setError(
          prepareError instanceof Error
            ? prepareError.message
            : 'Unable to prepare image.',
        )

        setPreparationStatus(
          'Preparation failed. Adjust crop and try again.',
        )
      } finally {
        setIsProcessing(false)
      }
    }

  const updateWidth = (
    width: number,
  ): void => {
    if (!meta) return

    const safeWidth =
      Math.max(1, Math.round(width || 1))

    const height =
      resize.lockAspectRatio
        ? Math.max(
            1,
            Math.round(
              safeWidth *
                (meta.height / meta.width),
            ),
          )
        : resize.height

    setResize((current) => ({
      ...current,
      width: safeWidth,
      height,
    }))
  }

  const updateHeight = (
    height: number,
  ): void => {
    if (!meta) return

    const safeHeight =
      Math.max(1, Math.round(height || 1))

    const width =
      resize.lockAspectRatio
        ? Math.max(
            1,
            Math.round(
              safeHeight *
                (meta.width / meta.height),
            ),
          )
        : resize.width

    setResize((current) => ({
      ...current,
      height: safeHeight,
      width,
    }))
  }

  const runProcessing =
    async (): Promise<void> => {
      if (
        !sourceFile ||
        !sourceUrl ||
        !meta ||
        !isPrepared
      ) {
        return
      }

      setError('')
      setIsProcessing(true)

      try {
        const result =
          await processImage({
            sourceUrl,
            outputFormat: format,
            quality,
            targetWidth:
              mode === 'resize'
                ? resize.width
                : undefined,
            targetHeight:
              mode === 'resize'
                ? resize.height
                : undefined,
          })

        resetProcessed()

        const url =
          URL.createObjectURL(result.blob)

        setProcessed({
          blob: result.blob,
          url,
          fileName:
            createOutputFileName(
              sourceFile.name,
              format,
            ),
          width: result.width,
          height: result.height,
        })

        const eventMap = {
          compress: 'compress_used',
          resize: 'resize_used',
          convert: 'convert_used',
          crop: 'crop_used',
        } as const

        trackSmartImageEvent(
          eventMap[mode],
          {
            input_size: sourceFile.size,
            output_size: result.blob.size,
            output_format: format,
            width: result.width,
            height: result.height,
          },
        )
      } catch (processingError) {
        setError(
          processingError instanceof Error
            ? processingError.message
            : 'Image processing failed.',
        )
      } finally {
        setIsProcessing(false)
      }
    }

  const downloadImage = (): void => {
    if (!processed) return

    const anchor =
      document.createElement('a')

    anchor.href = processed.url
    anchor.download = processed.fileName

    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    trackSmartImageEvent(
      'image_downloaded',
      {
        size: processed.blob.size,
        width: processed.width,
        height: processed.height,
        file_name: processed.fileName,
      },
    )
  }

  return (
    <main className="sit-page">
      <section className="sit-hero">
        <div>
          <span className="sit-eyebrow">
            1 Hub Apps · App #001
          </span>

          <h1>Smart Image Tools</h1>

          <p>
            Crop, correct, enhance, compress,
            resize and convert images privately
            in your browser.
          </p>
        </div>

        <div className="sit-privacy-pill">
          🔒 Local processing
        </div>
      </section>

      <section className="sit-shell">
        <ImageDropzone
          onFileSelected={selectFile}
          disabled={isProcessing}
        />

        {error && (
          <div
            className="sit-alert"
            role="alert"
          >
            {error}
          </div>
        )}

        {sourceFile &&
          meta &&
          sourceUrl && (
            <>
              {!isPrepared ? (
                <div className="sit-workspace sit-preparation-workspace">
                  <section className="sit-panel sit-preview-panel">
                    <div className="sit-panel-heading">
                      <div>
                        <span>
                          Step 1
                        </span>

                        <h2>
                          Fix image first
                        </h2>
                      </div>

                      <button
                        className="sit-text-button"
                        type="button"
                        onClick={clearSource}
                      >
                        Remove
                      </button>
                    </div>

                    <CropEditor
                      imageUrl={sourceUrl}
                      onExporterReady={
                        registerCropExporter
                      }
                      onChange={
                        resetProcessed
                      }
                    />
                  </section>

                  <section className="sit-panel sit-controls-panel">
                    <div className="sit-tool-body">
                      <div className="sit-preparation-steps">
                        <div className="is-active">
                          <strong>1</strong>
                          <span>
                            Auto crop
                          </span>
                        </div>

                        <div>
                          <strong>2</strong>
                          <span>
                            Auto correct
                          </span>
                        </div>

                        <div>
                          <strong>3</strong>
                          <span>
                            Local enhance
                          </span>
                        </div>
                      </div>

                      <div className="sit-status-box">
                        {preparationStatus}
                      </div>

                      <p>
                        Crop box ko move/resize
                        karo. Image tedi ho to
                        rotate handle se seedha
                        karo.
                      </p>

                      <label className="sit-output-format">
                        Working image format

                        <select
                          value={format}
                          onChange={(event) =>
                            setFormat(
                              event.target
                                .value as OutputFormat,
                            )
                          }
                        >
                          <option value="image/jpeg">
                            JPG
                          </option>

                          <option value="image/png">
                            PNG
                          </option>

                          <option value="image/webp">
                            WebP
                          </option>
                        </select>
                      </label>

                      <button
                        className="sit-primary-button"
                        type="button"
                        disabled={isProcessing}
                        onClick={
                          confirmCropAndPrepare
                        }
                      >
                        {isProcessing
                          ? 'Preparing image…'
                          : 'Fix & Continue'}
                      </button>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="sit-workspace">
                  <section className="sit-panel sit-preview-panel">
                    <div className="sit-panel-heading">
                      <div>
                        <span>
                          Working image
                        </span>

                        <h2>
                          Fixed and enhanced
                        </h2>
                      </div>

                      <button
                        className="sit-text-button"
                        type="button"
                        onClick={clearSource}
                      >
                        Start over
                      </button>
                    </div>

                    <div className="sit-image-frame">
                      <img
                        src={sourceUrl}
                        alt="Prepared image preview"
                      />
                    </div>

                    <div className="sit-ready-badge">
                      ✓ Auto cropped · Auto corrected · Enhanced
                    </div>

                    <div className="sit-meta-grid">
                      <div>
                        <span>File</span>
                        <strong title={meta.name}>
                          {meta.name}
                        </strong>
                      </div>

                      <div>
                        <span>Size</span>
                        <strong>
                          {formatBytes(meta.size)}
                        </strong>
                      </div>

                      <div>
                        <span>Dimensions</span>
                        <strong>
                          {meta.width} × {meta.height}
                        </strong>
                      </div>

                      <div>
                        <span>Format</span>
                        <strong>
                          {meta.type
                            .replace('image/', '')
                            .toUpperCase()}
                        </strong>
                      </div>
                    </div>
                  </section>

                  <section className="sit-panel sit-controls-panel">
                    <div
                      className="sit-tabs"
                      role="tablist"
                    >
                      {(
                        [
                          'compress',
                          'resize',
                          'convert',
                        ] as ToolMode[]
                      ).map((tool) => (
                        <button
                          key={tool}
                          type="button"
                          role="tab"
                          aria-selected={
                            mode === tool
                          }
                          className={
                            mode === tool
                              ? 'is-active'
                              : ''
                          }
                          onClick={() => {
                            setMode(tool)
                            resetProcessed()
                            setError('')
                          }}
                        >
                          {toolLabels[tool]}
                        </button>
                      ))}
                    </div>

                    <div className="sit-tool-body">
                      {mode ===
                        'compress' && (
                        <div className="sit-field-stack">
                          <label>
                            Image quality
                            <strong>
                              {Math.round(
                                quality * 100,
                              )}
                              %
                            </strong>

                            <input
                              type="range"
                              min={0.1}
                              max={1}
                              step={0.05}
                              value={quality}
                              onChange={(event) =>
                                setQuality(
                                  Number(
                                    event.target
                                      .value,
                                  ),
                                )
                              }
                            />
                          </label>

                          <p>
                            Lower quality creates
                            a smaller file.
                          </p>
                        </div>
                      )}

                      {mode === 'resize' && (
                        <div className="sit-field-stack">
                          <div className="sit-two-columns">
                            <label>
                              Width (px)

                              <input
                                type="number"
                                min={1}
                                max={16384}
                                value={resize.width}
                                onChange={(event) =>
                                  updateWidth(
                                    Number(
                                      event.target
                                        .value,
                                    ),
                                  )
                                }
                              />
                            </label>

                            <label>
                              Height (px)

                              <input
                                type="number"
                                min={1}
                                max={16384}
                                value={
                                  resize.height
                                }
                                onChange={(event) =>
                                  updateHeight(
                                    Number(
                                      event.target
                                        .value,
                                    ),
                                  )
                                }
                              />
                            </label>
                          </div>

                          <label className="sit-checkbox">
                            <input
                              type="checkbox"
                              checked={
                                resize.lockAspectRatio
                              }
                              onChange={(event) =>
                                setResize(
                                  (current) => ({
                                    ...current,
                                    lockAspectRatio:
                                      event.target
                                        .checked,
                                  }),
                                )
                              }
                            />

                            Lock aspect ratio
                          </label>
                        </div>
                      )}

                      {mode === 'convert' && (
                        <div className="sit-field-stack">
                          <label>
                            Output format

                            <select
                              value={format}
                              onChange={(event) =>
                                setFormat(
                                  event.target
                                    .value as OutputFormat,
                                )
                              }
                            >
                              <option value="image/jpeg">
                                JPG
                              </option>

                              <option value="image/png">
                                PNG
                              </option>

                              <option value="image/webp">
                                WebP
                              </option>
                            </select>
                          </label>
                        </div>
                      )}

                      {mode !== 'convert' && (
                        <label className="sit-output-format">
                          Output format

                          <select
                            value={format}
                            onChange={(event) =>
                              setFormat(
                                event.target
                                  .value as OutputFormat,
                              )
                            }
                          >
                            <option value="image/jpeg">
                              JPG
                            </option>

                            <option value="image/png">
                              PNG
                            </option>

                            <option value="image/webp">
                              WebP
                            </option>
                          </select>
                        </label>
                      )}

                      <button
                        className="sit-primary-button"
                        type="button"
                        disabled={isProcessing}
                        onClick={runProcessing}
                      >
                        {isProcessing
                          ? 'Processing…'
                          : `${toolLabels[mode]} image`}
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}

        {processed && (
          <section className="sit-panel sit-result-panel">
            <div className="sit-panel-heading">
              <div>
                <span>Processed</span>
                <h2>Ready to download</h2>
              </div>

              {compressionSaving !== null && (
                <div
                  className={
                    compressionSaving >= 0
                      ? 'sit-saving'
                      : 'sit-saving is-negative'
                  }
                >
                  {compressionSaving >= 0
                    ? `${compressionSaving}% smaller`
                    : `${Math.abs(
                        compressionSaving,
                      )}% larger`}
                </div>
              )}
            </div>

            <div className="sit-result-grid">
              <div className="sit-image-frame">
                <img
                  src={processed.url}
                  alt="Processed image preview"
                />
              </div>

              <div className="sit-result-details">
                <div>
                  <span>Output size</span>
                  <strong>
                    {formatBytes(
                      processed.blob.size,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Dimensions</span>
                  <strong>
                    {processed.width} ×{' '}
                    {processed.height}
                  </strong>
                </div>

                <div>
                  <span>File name</span>
                  <strong>
                    {processed.fileName}
                  </strong>
                </div>

                <button
                  className="sit-primary-button"
                  type="button"
                  onClick={downloadImage}
                >
                  Download image
                </button>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
