/**
 * Local Book & Spine Recognizer
 * Runs real-time edge saliency and frame stability on downscaled canvas (60/30 FPS)
 * to instantly identify and frame targeted books before and during server AI processing.
 */

export interface LocalTargetState {
  box: [number, number, number, number] // [ymin, xmin, ymax, xmax] in 0-1000 scale
  confidence: number // 0 to 1
  isSteady: boolean // Camera held steady enough to trigger snapshot
  isLocked: boolean // Target actively locked by user
  source: 'vision' | 'barcode'
  barcodeValue?: string
  motionScore: number
  steadyDurationMs: number
}

export class LocalRecognizer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private prevBuffer: Uint8ClampedArray | null = null
  private width = 64
  private height = 64

  private steadySince: number | null = null
  private motionThreshold = 22 // Threshold for camera movement
  private minSteadyMs = 600 // Milliseconds of stillness before triggering capture

  private smoothedBox: [number, number, number, number] | null = null
  private lastTarget: LocalTargetState | null = null
  private lockedDuringScanBox: [number, number, number, number] | null = null

  constructor(width = 64, height = 64, motionThreshold = 22, minSteadyMs = 600) {
    this.width = width
    this.height = height
    this.motionThreshold = motionThreshold
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
   * Process a video element frame to compute motion and local book bounds.
   */
  processFrame(video: HTMLVideoElement, isCurrentlyScanning: boolean): LocalTargetState | null {
    if (!this.initCanvas() || !this.ctx) return null
    if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended) {
      return null
    }

    const now = Date.now()

    // If scanning is active, preserve the locked target box so it doesn't jump or disappear
    if (isCurrentlyScanning && this.lockedDuringScanBox) {
      return {
        box: this.lockedDuringScanBox,
        confidence: 0.95,
        isSteady: true,
        isLocked: true,
        source: this.lastTarget?.source || 'vision',
        barcodeValue: this.lastTarget?.barcodeValue,
        motionScore: 0,
        steadyDurationMs: 1500,
      }
    }

    // Draw downscaled frame
    this.ctx.drawImage(video, 0, 0, this.width, this.height)
    const imgData = this.ctx.getImageData(0, 0, this.width, this.height)
    const data = imgData.data
    const totalPixels = this.width * this.height

    // Motion calculation
    if (!this.prevBuffer || this.prevBuffer.length !== data.length) {
      this.prevBuffer = new Uint8ClampedArray(data)
      this.steadySince = now
      return null
    }

    let diffSum = 0
    for (let i = 0; i < data.length; i += 4) {
      // Compare green/luminance channel
      diffSum += Math.abs(data[i + 1] - this.prevBuffer[i + 1])
    }
    this.prevBuffer.set(data)

    const motionScore = diffSum / totalPixels

    // Check camera steadiness
    const isMoving = motionScore >= this.motionThreshold
    if (isMoving) {
      this.steadySince = null
    } else if (!this.steadySince) {
      this.steadySince = now
    }

    const steadyDurationMs = this.steadySince ? now - this.steadySince : 0
    const isSteady = steadyDurationMs >= this.minSteadyMs
    const isLocked = steadyDurationMs >= 200

    // If user is shaking/panning rapidly and not locked, clear or fade out target
    if (motionScore > 38 && !isCurrentlyScanning) {
      this.smoothedBox = null
      this.lastTarget = null
      return null
    }

    // Edge gradient & saliency detection
    let totalEnergy = 0
    const rowEnergy = new Float32Array(this.height)
    const colEnergy = new Float32Array(this.width)

    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        // Luminance difference across neighboring pixels
        const lumL = data[(y * this.width + (x - 1)) * 4 + 1]
        const lumR = data[(y * this.width + (x + 1)) * 4 + 1]
        const lumU = data[((y - 1) * this.width + x) * 4 + 1]
        const lumD = data[((y + 1) * this.width + x) * 4 + 1]

        const gx = Math.abs(lumR - lumL)
        const gy = Math.abs(lumD - lumU)

        // Center weight: books are naturally framed towards the middle
        const dx = (x - this.width / 2) / (this.width / 2)
        const dy = (y - this.height / 2) / (this.height / 2)
        const centerDistSq = dx * dx + dy * dy
        const centerWeight = Math.max(0.3, 1.0 - 0.45 * Math.min(1, centerDistSq))

        const energy = (gx + gy) * centerWeight
        rowEnergy[y] += energy
        colEnergy[x] += energy
        totalEnergy += energy
      }
    }

    const usablePixels = (this.width - 2) * (this.height - 2)
    const avgEnergy = totalEnergy / usablePixels

    // If scene is blank wall or dark without edges, return null
    if (avgEnergy < 4.0 && !this.lastTarget) {
      return null
    }

    // Find energy bounds (12th to 88th percentile)
    const getPercentileBounds = (arr: Float32Array, total: number) => {
      let sum = 0
      let low = 0
      let high = arr.length - 1
      const tLow = total * 0.12
      const tHigh = total * 0.88

      for (let i = 0; i < arr.length; i++) {
        sum += arr[i]
        if (low === 0 && sum >= tLow) low = i
        if (sum >= tHigh) {
          high = i
          break
        }
      }
      return { low, high }
    }

    const yBounds = getPercentileBounds(rowEnergy, totalEnergy)
    const xBounds = getPercentileBounds(colEnergy, totalEnergy)

    let rawBox: [number, number, number, number] = [
      Math.round((yBounds.low / this.height) * 1000),
      Math.round((xBounds.low / this.width) * 1000),
      Math.round((yBounds.high / this.height) * 1000),
      Math.round((xBounds.high / this.width) * 1000),
    ]

    // Ensure minimum box size so it feels like a real book (at least 20% height, 15% width)
    const heightSpan = rawBox[2] - rawBox[0]
    if (heightSpan < 220) {
      const midY = (rawBox[0] + rawBox[2]) / 2
      rawBox[0] = Math.max(40, Math.round(midY - 110))
      rawBox[2] = Math.min(960, Math.round(midY + 110))
    }

    const widthSpan = rawBox[3] - rawBox[1]
    if (widthSpan < 160) {
      const midX = (rawBox[1] + rawBox[3]) / 2
      rawBox[1] = Math.max(40, Math.round(midX - 80))
      rawBox[3] = Math.min(960, Math.round(midX + 80))
    }

    // Exponential moving average for silky-smooth box tracking
    if (!this.smoothedBox) {
      this.smoothedBox = [...rawBox]
    } else {
      const alpha = isLocked ? 0.25 : 0.4
      this.smoothedBox = [
        Math.round(this.smoothedBox[0] * (1 - alpha) + rawBox[0] * alpha),
        Math.round(this.smoothedBox[1] * (1 - alpha) + rawBox[1] * alpha),
        Math.round(this.smoothedBox[2] * (1 - alpha) + rawBox[2] * alpha),
        Math.round(this.smoothedBox[3] * (1 - alpha) + rawBox[3] * alpha),
      ]
    }

    const confidence = Math.min(1.0, Math.max(0.4, avgEnergy / 18))

    const target: LocalTargetState = {
      box: this.smoothedBox,
      confidence,
      isSteady,
      isLocked,
      source: 'vision',
      motionScore,
      steadyDurationMs,
    }

    this.lastTarget = target

    // If camera steadied and is about to trigger scan, lock this box coordinates for the scan
    if (isSteady) {
      this.lockedDuringScanBox = [...this.smoothedBox]
    }

    return target
  }

  /**
   * Set target explicitly from a detected barcode
   */
  setBarcodeTarget(box: [number, number, number, number], barcode: string): LocalTargetState {
    this.smoothedBox = [...box]
    this.lockedDuringScanBox = [...box]
    this.steadySince = Date.now() - this.minSteadyMs

    const target: LocalTargetState = {
      box,
      confidence: 1.0,
      isSteady: true,
      isLocked: true,
      source: 'barcode',
      barcodeValue: barcode,
      motionScore: 0,
      steadyDurationMs: this.minSteadyMs,
    }

    this.lastTarget = target
    return target
  }

  /**
   * Release scan lock
   */
  clearScanLock(): void {
    this.lockedDuringScanBox = null
  }

  reset(): void {
    this.steadySince = null
    this.prevBuffer = null
    this.smoothedBox = null
    this.lastTarget = null
    this.lockedDuringScanBox = null
  }
}
