/**
 * Frame Stability Analyzer
 * Evaluates camera motion by comparing downsampled luminance frames on a 64x64 canvas.
 */
export class FrameStabilityAnalyzer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private prevBuffer: Uint8ClampedArray | null = null
  private width = 64
  private height = 64
  private steadySince: number | null = null
  private threshold = 18 // Motion variance threshold (lower = stricter)
  private minSteadyMs = 700 // Time camera must be steady before triggering

  constructor(threshold = 18, minSteadyMs = 700) {
    this.threshold = threshold
    this.minSteadyMs = minSteadyMs
  }

  private initCanvas(): boolean {
    if (typeof window === 'undefined') return false
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
      this.canvas.width = this.width
      this.canvas.height = this.height
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    }
    return !!this.ctx
  }

  /**
   * Process a video element frame.
   * Returns { isSteady: boolean, motionScore: number, steadyDurationMs: number }
   */
  processFrame(video: HTMLVideoElement): {
    isSteady: boolean
    motionScore: number
    steadyDurationMs: number
  } {
    if (!this.initCanvas() || !this.ctx) {
      return { isSteady: false, motionScore: 0, steadyDurationMs: 0 }
    }

    if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended) {
      return { isSteady: false, motionScore: 0, steadyDurationMs: 0 }
    }

    // Draw downscaled frame
    this.ctx.drawImage(video, 0, 0, this.width, this.height)
    const imgData = this.ctx.getImageData(0, 0, this.width, this.height)
    const data = imgData.data
    const totalPixels = this.width * this.height

    if (!this.prevBuffer || this.prevBuffer.length !== data.length) {
      this.prevBuffer = new Uint8ClampedArray(data)
      this.steadySince = Date.now()
      return { isSteady: false, motionScore: 0, steadyDurationMs: 0 }
    }

    let diffSum = 0
    // Sample green channel or luminance
    for (let i = 0; i < data.length; i += 4) {
      const diff = Math.abs(data[i + 1] - this.prevBuffer[i + 1])
      diffSum += diff
    }

    // Update previous buffer
    this.prevBuffer.set(data)

    const motionScore = diffSum / totalPixels
    const now = Date.now()

    if (motionScore < this.threshold) {
      if (!this.steadySince) {
        this.steadySince = now
      }
      const steadyDurationMs = now - this.steadySince
      return {
        isSteady: steadyDurationMs >= this.minSteadyMs,
        motionScore,
        steadyDurationMs,
      }
    } else {
      this.steadySince = null
      return {
        isSteady: false,
        motionScore,
        steadyDurationMs: 0,
      }
    }
  }

  reset(): void {
    this.steadySince = null
    this.prevBuffer = null
  }
}

/**
 * Capture a high-quality, lightweight JPEG snapshot from a video element
 */
export function captureVideoSnapshot(
  video: HTMLVideoElement,
  maxWidth = 1024,
  quality = 0.75
): string | null {
  if (typeof window === 'undefined') return null
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null

  const canvas = document.createElement('canvas')
  const scale = Math.min(1, maxWidth / video.videoWidth)
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}
