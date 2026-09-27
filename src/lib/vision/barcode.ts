/**
 * Barcode Scanner using native BarcodeDetector API (fast on mobile Chrome/Safari)
 */

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): BarcodeDetectorInstance
      getSupportedFormats(): Promise<string[]>
    }
  }
}

interface DetectedBarcode {
  rawValue: string
  format: string
  boundingBox?: DOMRectReadOnly
}

interface BarcodeDetectorInstance {
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>
}

let detectorInstance: BarcodeDetectorInstance | null = null
let isSupported: boolean | null = null

export async function isBarcodeDetectionSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (isSupported !== null) return isSupported
  try {
    if ('BarcodeDetector' in window && window.BarcodeDetector) {
      const formats = await window.BarcodeDetector.getSupportedFormats()
      isSupported = formats.includes('ean_13') || formats.includes('upc_a')
      return isSupported
    }
  } catch {
    // Ignore error
  }
  isSupported = false
  return false
}

export async function scanBarcodeFromVideo(
  video: HTMLVideoElement
): Promise<string | null> {
  if (typeof window === 'undefined') return null
  if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended) {
    return null
  }

  try {
    if (!detectorInstance && window.BarcodeDetector) {
      detectorInstance = new window.BarcodeDetector({
        formats: ['ean_13', 'upc_a', 'upc_e', 'qr_code'],
      })
    }

    if (!detectorInstance) return null

    const barcodes = await detectorInstance.detect(video)
    if (barcodes && barcodes.length > 0) {
      // Look for standard 10 or 13 digit ISBN/EAN
      const bookBarcode = barcodes.find((b) => {
        const val = b.rawValue.trim()
        return val.startsWith('978') || val.startsWith('979') || val.length === 10 || val.length === 13
      })
      return bookBarcode ? bookBarcode.rawValue : barcodes[0].rawValue
    }
  } catch {
    // Gracefully handle scan frames where detector is busy
  }

  return null
}
