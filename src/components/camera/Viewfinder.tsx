import React, { useEffect, useRef, useState, useCallback } from 'react'
import { CameraOff, RefreshCw } from 'lucide-react'
import {
  captureVideoSnapshot,
} from '../../lib/vision/frame-stability'
import { scanBarcodeFromVideoDetailed } from '../../lib/vision/barcode'
import { LocalRecognizer, type LocalTargetState } from '../../lib/vision/local-recognizer'

interface ViewfinderProps {
  onScanFrame: (base64Data: string, source: 'vision' | 'barcode', isbn?: string) => Promise<void>
  isScanning: boolean
  facingMode: 'environment' | 'user'
  isTorchOn: boolean
  onTorchAvailabilityChange: (available: boolean) => void
  onLocalTargetChange?: (target: LocalTargetState | null) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  videoRef: React.RefObject<HTMLVideoElement | null>
}

export const Viewfinder: React.FC<ViewfinderProps> = ({
  onScanFrame,
  isScanning,
  facingMode,
  isTorchOn,
  onTorchAvailabilityChange,
  onLocalTargetChange,
  containerRef,
  videoRef,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: 1280,
    height: 720,
  })

  const localRecognizerRef = useRef<LocalRecognizer>(new LocalRecognizer(64, 64, 22, 600))
  const lastScanTimestampRef = useRef<number>(0)
  const animationFrameIdRef = useRef<number | null>(null)
  const barcodeIntervalIdRef = useRef<NodeJS.Timeout | null>(null)

  // Clear scan lock when scanning completes
  useEffect(() => {
    if (!isScanning) {
      localRecognizerRef.current.clearScanLock()
    }
  }, [isScanning])

  // Initialize or update camera stream
  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      setStream(mediaStream)
      setHasPermission(true)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play().catch(() => {})
      }

      // Check torch support
      const videoTrack = mediaStream.getVideoTracks()[0]
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities?.() as { torch?: boolean } | undefined
        onTorchAvailabilityChange(!!capabilities?.torch)
      }
    } catch (err) {
      console.warn('[Camera] getUserMedia failed:', err)
      setHasPermission(false)
      onTorchAvailabilityChange(false)
    }
  }, [facingMode, onTorchAvailabilityChange])

  // Manage Torch
  useEffect(() => {
    if (!stream) return
    const track = stream.getVideoTracks()[0]
    if (track) {
      const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined
      if (capabilities?.torch) {
        track
          .applyConstraints({
            advanced: [{ torch: isTorchOn } as MediaTrackConstraintSet],
          })
          .catch(() => {})
      }
    }
  }, [isTorchOn, stream])

  // Start camera on mount or facingMode change
  useEffect(() => {
    localRecognizerRef.current.reset()
    startCamera()
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [facingMode])

  // Video metadata loaded listener
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.videoWidth || 1280,
        height: videoRef.current.videoHeight || 720,
      })
    }
  }

  // Barcode scanning polling loop (every 350ms)
  useEffect(() => {
    if (!videoRef.current) return

    barcodeIntervalIdRef.current = setInterval(async () => {
      if (isScanning || !videoRef.current) return
      const result = await scanBarcodeFromVideoDetailed(videoRef.current)
      if (result) {
        console.log('[Viewfinder] Native barcode detected:', result.rawValue)
        if (result.box2d) {
          const target = localRecognizerRef.current.setBarcodeTarget(result.box2d, result.rawValue)
          onLocalTargetChange?.(target)
        }
        onScanFrame('', 'barcode', result.rawValue)
      }
    }, 350)

    return () => {
      if (barcodeIntervalIdRef.current) {
        clearInterval(barcodeIntervalIdRef.current)
      }
    }
  }, [isScanning, onScanFrame, onLocalTargetChange])

  // Real-time local recognition and frame stability loop
  useEffect(() => {
    const loop = () => {
      const video = videoRef.current
      const now = Date.now()

      if (video && video.readyState >= 2) {
        const target = localRecognizerRef.current.processFrame(video, isScanning)
        onLocalTargetChange?.(target)

        if (
          target?.isSteady &&
          !isScanning &&
          now - lastScanTimestampRef.current > 2000
        ) {
          const snapshot = captureVideoSnapshot(video, 1024, 0.75)
          if (snapshot) {
            lastScanTimestampRef.current = now
            onScanFrame(snapshot, 'vision')
          }
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(loop)
    }

    animationFrameIdRef.current = requestAnimationFrame(loop)

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [isScanning, onScanFrame, onLocalTargetChange])


  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center select-none"
    >
      {hasPermission === false ? (
        // Camera permission denied / unavailable
        <div className="p-8 text-center max-w-sm space-y-4 z-20">
          <div className="w-16 h-16 rounded-3xl bg-neutral-800 border border-white/10 mx-auto flex items-center justify-center text-white/50">
            <CameraOff className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Camera Access Required</h3>
          <p className="text-xs text-white/60 leading-relaxed">
            Please allow camera permissions in your browser to scan book spines and covers in real-time.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={startCamera}
              className="py-2.5 px-4 rounded-xl bg-white text-black font-semibold text-xs flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Permission</span>
            </button>
          </div>
        </div>
      ) : (
        // Live HTML5 Video element
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          onLoadedMetadata={handleLoadedMetadata}
          className="w-full h-full object-cover transform"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        />
      )}

      {/* Subtle vignette border scrim */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-black/40 z-10" />
    </div>
  )
}
