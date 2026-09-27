import type { DetectedBook } from '../books/types'

export interface ScreenBox {
  left: number
  top: number
  width: number
  height: number
  centerX: number
  centerY: number
}

export interface TrackedBookItem {
  id: string
  book: DetectedBook
  currentBox: ScreenBox
  targetBox: ScreenBox
  opacity: number
  createdAt: number
  lastUpdated: number
}

/**
 * Map normalized 0-1000 box coordinates to container pixel coordinates,
 * taking object-fit: cover scaling into account.
 */
export function mapNormalizedBoxToContainer(
  box: [number, number, number, number], // [ymin, xmin, ymax, xmax]
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number
): ScreenBox {
  const [ymin, xmin, ymax, xmax] = box

  // Normalized fractions (0.0 to 1.0)
  const normTop = Math.max(0, Math.min(1000, ymin)) / 1000
  const normLeft = Math.max(0, Math.min(1000, xmin)) / 1000
  const normBottom = Math.max(0, Math.min(1000, ymax)) / 1000
  const normRight = Math.max(0, Math.min(1000, xmax)) / 1000

  // Calculate cover scaling
  const videoAspect = (videoWidth || 1) / (videoHeight || 1)
  const containerAspect = (containerWidth || 1) / (containerHeight || 1)

  let renderWidth = containerWidth
  let renderHeight = containerHeight
  let offsetX = 0
  let offsetY = 0

  if (videoAspect > containerAspect) {
    // Video is wider than container: cropped horizontally
    renderHeight = containerHeight
    renderWidth = containerHeight * videoAspect
    offsetX = (containerWidth - renderWidth) / 2
  } else {
    // Video is taller than container: cropped vertically
    renderWidth = containerWidth
    renderHeight = containerWidth / videoAspect
    offsetY = (containerHeight - renderHeight) / 2
  }

  const left = offsetX + normLeft * renderWidth
  const top = offsetY + normTop * renderHeight
  const width = Math.max(30, (normRight - normLeft) * renderWidth)
  const height = Math.max(30, (normBottom - normTop) * renderHeight)

  return {
    left,
    top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  }
}

/**
 * Linear interpolation helper
 */
export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor
}

/**
 * Smoothly updates tracked items towards their target positions at 60 FPS
 */
export function updateTrackedItems(
  items: TrackedBookItem[],
  smoothing = 0.25,
  fadeTimeoutMs = 6000
): TrackedBookItem[] {
  const now = Date.now()

  return items
    .map((item) => {
      const age = now - item.lastUpdated
      let opacity = 1

      if (age > fadeTimeoutMs - 1500) {
        // Fade out during the last 1.5 seconds of lifetime
        opacity = Math.max(0, (fadeTimeoutMs - age) / 1500)
      }

      // Lerp current screen coordinates towards target
      const newLeft = lerp(item.currentBox.left, item.targetBox.left, smoothing)
      const newTop = lerp(item.currentBox.top, item.targetBox.top, smoothing)
      const newWidth = lerp(item.currentBox.width, item.targetBox.width, smoothing)
      const newHeight = lerp(item.currentBox.height, item.targetBox.height, smoothing)

      return {
        ...item,
        currentBox: {
          left: newLeft,
          top: newTop,
          width: newWidth,
          height: newHeight,
          centerX: newLeft + newWidth / 2,
          centerY: newTop + newHeight / 2,
        },
        opacity,
      }
    })
    .filter((item) => now - item.lastUpdated < fadeTimeoutMs && item.opacity > 0.05)
}
