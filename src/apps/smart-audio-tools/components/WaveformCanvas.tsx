import { useEffect, useRef } from 'react'

type Props = {
  buffer: AudioBuffer | null
}

export default function WaveformCanvas({ buffer }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !buffer) return
    const context = canvas.getContext('2d')
    if (!context) return

    const ratio = window.devicePixelRatio || 1
    const width = Math.max(320, canvas.clientWidth)
    const height = 150
    canvas.width = width * ratio
    canvas.height = height * ratio
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)

    const data = buffer.getChannelData(0)
    const step = Math.max(1, Math.floor(data.length / width))
    context.beginPath()
    context.strokeStyle = '#2563eb'
    context.lineWidth = 1

    for (let x = 0; x < width; x += 1) {
      let min = 1
      let max = -1
      const start = x * step
      for (let i = 0; i < step && start + i < data.length; i += 1) {
        const value = data[start + i]
        if (value < min) min = value
        if (value > max) max = value
      }
      const y1 = ((1 + min) / 2) * height
      const y2 = ((1 + max) / 2) * height
      context.moveTo(x, y1)
      context.lineTo(x, y2)
    }
    context.stroke()
  }, [buffer])

  return <canvas ref={canvasRef} className="sat-waveform" aria-label="Audio waveform preview" />
}
