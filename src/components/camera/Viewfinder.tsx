import React, { useEffect, useRef, useState, useCallback } from 'react'
import { CameraOff, RefreshCw, Sparkles } from 'lucide-react'
import {
  FrameStabilityAnalyzer,
  captureVideoSnapshot,
} from '../../lib/vision/frame-stability'
import { scanBarcodeFromVideo } from '../../lib/vision/barcode'

interface ViewfinderProps {
  onScanFrame: (base64Data: string, source: 'vision' | 'barcode', isbn?: string) => Promise<void>
  isScanning: boolean
  sampleImageSrc: string | null
  onClearSample: () => void
  facingMode: 'environment' | 'user'
  isTorchOn: boolean
  onTorchAvailabilityChange: (available: boolean) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  videoRef: React.RefObject<HTMLVideoElement | null>
}

export const Viewfinder: React.FC<ViewfinderProps> = ({
  onScanFrame,
  isScanning,
  sampleImageSrc,
  onClearSample,
  facingMode,
  isTorchOn,
  onTorchAvailabilityChange,
  containerRef,
  videoRef,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: 1280,
    height: 720,
  })

  const stabilityAnalyzerRef = useRef<FrameStabilityAnalyzer>(new FrameStabilityAnalyzer(20, 800))
  const lastScanTimestampRef = useRef<number>(0)
  const animationFrameIdRef = useRef<number | null>(null)
  const barcodeIntervalIdRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize or update camera stream
  const startCamera = useCallback(async () => {
    if (sampleImageSrc) return // Do not start camera if test photo is active

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
  }, [facingMode, sampleImageSrc, onTorchAvailabilityChange])

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
    if (!sampleImageSrc) {
      startCamera()
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [facingMode, sampleImageSrc])

  // Video metadata loaded listener
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.videoWidth || 1280,
        height: videoRef.current.videoHeight || 720,
      })
    }
  }

  // Barcode scanning polling loop (every 400ms)
  useEffect(() => {
    if (sampleImageSrc || !videoRef.current) return

    barcodeIntervalIdRef.current = setInterval(async () => {
      if (isScanning || !videoRef.current) return
      const isbn = await scanBarcodeFromVideo(videoRef.current)
      if (isbn) {
        console.log('[Viewfinder] Native barcode detected:', isbn)
        onScanFrame('', 'barcode', isbn)
      }
    }, 400)

    return () => {
      if (barcodeIntervalIdRef.current) {
        clearInterval(barcodeIntervalIdRef.current)
      }
    }
  }, [sampleImageSrc, isScanning, onScanFrame])

  // 30 FPS frame stability loop
  useEffect(() => {
    if (sampleImageSrc) return

    const loop = () => {
      const video = videoRef.current
      const now = Date.now()

      if (
        video &&
        video.readyState >= 2 &&
        !isScanning &&
        now - lastScanTimestampRef.current > 2000
      ) {
        const { isSteady } = stabilityAnalyzerRef.current.processFrame(video)

        if (isSteady) {
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
  }, [sampleImageSrc, isScanning, onScanFrame])

  // Handle sample image auto-scan once loaded
  useEffect(() => {
    if (!sampleImageSrc) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = sampleImageSrc
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        const base64 = canvas.toDataURL('image/jpeg', 0.8)
        onScanFrame(base64, 'vision')
      }
    }
  }, [sampleImageSrc, onScanFrame])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center select-none"
    >
      {/* Sample Image Mode */}
      {sampleImageSrc ? (
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            src={sampleImageSrc}
            alt="Sample Shelf"
            className="w-full h-full object-cover"
          />
          <div className="absolute top-20 left-4 z-30">
            <button
              onClick={onClearSample}
              className="px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 backdrop-blur-xl text-cyan-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-cyan-500/30 transition-all shadow-lg shadow-cyan-500/20"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Sample Mode Active (Tap to return to Camera)</span>
            </button>
          </div>
        </div>
      ) : hasPermission === false ? (
        // Camera permission denied / unavailable
        <div className="p-8 text-center max-w-sm space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-neutral-800 border border-white/10 mx-auto flex items-center justify-center text-white/50">
            <CameraOff className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Camera Access Required</h3>
          <p className="text-xs text-white/60 leading-relaxed">
            Please allow camera permissions in your browser to scan book spines in real-time, or test using sample library shelf photos.
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

      {/* Scanning radar line animation */}
      {isScanning && (
        <div className="absolute inset-x-0 h-1 z-30 pointer-events-none bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-scan-pulse" />
      )}

      {/* Subtle vignette border scrim */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-black/40 z-10" />
    </div>
  )
}
