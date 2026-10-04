import React, { useEffect, useRef, useState, useCallback } from 'react'
import { CameraOff, RefreshCw } from 'lucide-react'
import {
  captureVideoSnapshot,
} from '../../lib/vision/frame-stability'
import { scanBarcodeFromVideoDetailed } from '../../lib/vision/barcode'
import { LocalRecognizer } from '../../lib/vision/local-recognizer'
import { mapNormalizedBoxToContainer } from '../../lib/vision/tracker'

interface ViewfinderProps {
  onScanFrame: (
    base64Data: string,
    source: 'vision' | 'barcode',
    isbn?: string,
    targetBox?: [number, number, number, number]
  ) => Promise<void>
  isScanning: boolean
  isAutoScan?: boolean
  facingMode: 'environment' | 'user'
  isTorchOn: boolean
  onTorchAvailabilityChange: (available: boolean) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  videoRef: React.RefObject<HTMLVideoElement | null>
  onTargetBoxChange?: (box: [number, number, number, number] | null) => void
  flashTriggerRef?: React.MutableRefObject<(() => void) | null>
}

export const Viewfinder: React.FC<ViewfinderProps> = ({
  onScanFrame,
  isScanning,
  isAutoScan = true,
  facingMode,
  isTorchOn,
  onTorchAvailabilityChange,
  containerRef,
  videoRef,
  onTargetBoxChange,
  flashTriggerRef,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [shutterFlash, setShutterFlash] = useState(false)
  const [, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: 1280,
    height: 720,
  })

  const localRecognizerRef = useRef<LocalRecognizer>(new LocalRecognizer(64, 64, 22, 550))
  const lastScanTimestampRef = useRef<number>(0)
  const hasMovedSinceLastScanRef = useRef<boolean>(true)
  const isFirstMountRef = useRef<boolean>(true)
  const animationFrameIdRef = useRef<number | null>(null)
  const barcodeIntervalIdRef = useRef<NodeJS.Timeout | null>(null)
  const reticleRef = useRef<HTMLDivElement | null>(null)
  const reticleLabelRef = useRef<HTMLSpanElement | null>(null)

  const triggerFlash = useCallback(() => {
    setShutterFlash(true)
    setTimeout(() => setShutterFlash(false), 120)
  }, [])

  useEffect(() => {
    if (flashTriggerRef) {
      flashTriggerRef.current = triggerFlash
    }
  }, [flashTriggerRef, triggerFlash])

  // Clear scan lock and reset motion cooldown when scanning completes
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false
      return
    }
    if (!isScanning) {
      localRecognizerRef.current.clearScanLock()
      lastScanTimestampRef.current = Date.now()
      hasMovedSinceLastScanRef.current = false
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
          localRecognizerRef.current.setBarcodeTarget(result.box2d, result.rawValue)
        }
        triggerFlash()
        onScanFrame('', 'barcode', result.rawValue, result.box2d)
      }
    }, 350)

    return () => {
      if (barcodeIntervalIdRef.current) {
        clearInterval(barcodeIntervalIdRef.current)
      }
    }
  }, [isScanning, onScanFrame, triggerFlash])

  // Real-time local recognition and frame stability loop
  useEffect(() => {
    const loop = () => {
      const video = videoRef.current
      const now = Date.now()

      if (video && video.readyState >= 2) {
        const target = localRecognizerRef.current.processFrame(video, isScanning)

        // Track when camera moves significantly so we know the scene has changed
        const currentMotion = target?.motionScore ?? localRecognizerRef.current.lastMotionScore
        if (currentMotion > 16) {
          hasMovedSinceLastScanRef.current = true
        }

        // Notify parent of latest targeted box
        if (onTargetBoxChange) {
          onTargetBoxChange(target && target.confidence > 0.35 ? target.box : null)
        }

        // Real-time Optical Targeting Reticle update (60 FPS hardware accelerated)
        if (reticleRef.current) {
          if (target && target.confidence > 0.35) {
            const container = containerRef.current
            const cWidth = container?.clientWidth || window.innerWidth
            const cHeight = container?.clientHeight || window.innerHeight
            const vWidth = video.videoWidth || 1280
            const vHeight = video.videoHeight || 720

            const box = mapNormalizedBoxToContainer(target.box, vWidth, vHeight, cWidth, cHeight)

            reticleRef.current.style.opacity = '1'
            reticleRef.current.style.transform = `translate3d(${box.left}px, ${box.top}px, 0)`
            reticleRef.current.style.width = `${box.width}px`
            reticleRef.current.style.height = `${box.height}px`

            if (reticleLabelRef.current) {
              if (target.isSteady) {
                reticleLabelRef.current.innerText =
                  target.source === 'barcode' ? 'Barcode Detected' : '● Book Locked • Ready'
                reticleLabelRef.current.className =
                  'px-2.5 py-0.5 rounded-full bg-emerald-500/90 text-black font-bold text-[10px] tracking-wide shadow-md backdrop-blur-md'
              } else {
                reticleLabelRef.current.innerText = 'Aiming at spine...'
                reticleLabelRef.current.className =
                  'px-2.5 py-0.5 rounded-full bg-black/80 border border-amber-400/50 text-amber-300 font-medium text-[10px] tracking-wide shadow-md backdrop-blur-md'
              }
            }
          } else {
            reticleRef.current.style.opacity = '0'
          }
        }

        // Auto-scan ONLY when user has enabled isAutoScan, scene has moved, camera is steady, and cooled down (1.6s)
        if (
          isAutoScan &&
          target?.isSteady &&
          !isScanning &&
          hasMovedSinceLastScanRef.current &&
          now - lastScanTimestampRef.current > 1600
        ) {
          const snapshot = captureVideoSnapshot(video, 1024, 0.75)
          if (snapshot) {
            lastScanTimestampRef.current = now
            hasMovedSinceLastScanRef.current = false
            triggerFlash()
            onScanFrame(snapshot, 'vision', undefined, target.box)
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
  }, [isScanning, isAutoScan, onScanFrame, onTargetBoxChange, triggerFlash])

  return (
    <div
      ref={containerRef}
      suppressHydrationWarning
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

      {/* Real-time Optical Targeting Reticle (60 FPS hardware accelerated) */}
      <div
        ref={reticleRef}
        style={{
          opacity: 0,
          transform: 'translate3d(0, 0, 0)',
        }}
        className="absolute top-0 left-0 pointer-events-none transition-opacity duration-150 z-20 rounded-xl"
      >
        {/* 4 Corner Markers */}
        <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-400 rounded-tl-sm transition-colors" />
        <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-400 rounded-tr-sm transition-colors" />
        <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-400 rounded-bl-sm transition-colors" />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-400 rounded-br-sm transition-colors" />

        {/* Centered Reticle Label */}
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
          <span
            ref={reticleLabelRef}
            className="px-2.5 py-0.5 rounded-full bg-black/80 border border-amber-400/50 text-amber-300 font-semibold text-[10px] tracking-wide backdrop-blur-md shadow-md"
          >
            Aiming at spine...
          </span>
        </div>
      </div>

      {/* Camera Shutter Flash Effect */}
      <div
        className={`absolute inset-0 bg-white pointer-events-none z-30 transition-opacity duration-150 ${
          shutterFlash ? 'opacity-35' : 'opacity-0'
        }`}
      />

      {/* Subtle vignette border scrim */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-black/40 z-10" />
    </div>
  )
}
