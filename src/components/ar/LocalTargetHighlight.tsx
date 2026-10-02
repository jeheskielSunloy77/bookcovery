import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { LocalTargetState } from '../../lib/vision/local-recognizer'
import { mapNormalizedBoxToContainer } from '../../lib/vision/tracker'

interface LocalTargetHighlightProps {
  target: LocalTargetState | null
  isScanning: boolean
  containerWidth: number
  containerHeight: number
  videoWidth: number
  videoHeight: number
  hasDetectedBooks: boolean
}

export const LocalTargetHighlight: React.FC<LocalTargetHighlightProps> = ({
  target,
  isScanning,
  containerWidth,
  containerHeight,
  videoWidth,
  videoHeight,
  hasDetectedBooks,
}) => {
  const [loadingStep, setLoadingStep] = useState(0)

  // Cycle loading messages during scan so the user sees continuous progress
  useEffect(() => {
    if (!isScanning) {
      setLoadingStep(0)
      return
    }

    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % 3)
    }, 900)

    return () => clearInterval(interval)
  }, [isScanning])

  // If there are already persistent detected book overlays and we are not currently scanning a new target,
  // hide the local target to avoid visual clutter
  if (!target || (!isScanning && hasDetectedBooks)) {
    return null
  }

  // Map 0-1000 normalized coordinates to screen container
  const screenBox = mapNormalizedBoxToContainer(
    target.box,
    videoWidth || 1280,
    videoHeight || 720,
    containerWidth || window.innerWidth,
    containerHeight || window.innerHeight
  )

  const isBarcode = target.source === 'barcode'
  const isLocked = target.isLocked || isScanning

  // Status colors based on current phase
  const reticleColor = isScanning
    ? 'border-cyan-400'
    : isLocked
      ? 'border-emerald-400'
      : 'border-white/60'

  const glowShadow = isScanning
    ? '0 0 24px rgba(34, 211, 238, 0.45)'
    : isLocked
      ? '0 0 16px rgba(52, 211, 153, 0.35)'
      : '0 0 8px rgba(255, 255, 255, 0.15)'

  // Loading subtext messages
  const loadingSubtexts = isBarcode
    ? [
        'Reading ISBN barcode...',
        'Querying Open Library edition...',
        'Retrieving cover & reader ratings...',
      ]
    : [
        'Analyzing book cover & spine with Gemini AI...',
        'Matching title in Open Library & Google Books...',
        'Compiling ratings, author & synopses...',
      ]

  // Positioning the floating card: prefer above the box, fallback to below if too close to top
  const pillLeft = screenBox.centerX
  const pillTop =
    screenBox.top > 130
      ? screenBox.top - 84
      : screenBox.top + screenBox.height + 14

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* 4 Corner Optical Reticle Brackets */}
      <div
        style={{
          left: `${screenBox.left}px`,
          top: `${screenBox.top}px`,
          width: `${screenBox.width}px`,
          height: `${screenBox.height}px`,
          boxShadow: glowShadow,
        }}
        className={`absolute rounded-lg transition-all duration-150 ${
          isScanning ? 'animate-pulse' : ''
        }`}
      >
        {/* Top-Left Corner */}
        <span
          className={`absolute -top-0.5 -left-0.5 w-5 h-5 border-t-[2.5px] border-l-[2.5px] ${reticleColor} rounded-tl-sm`}
        />
        {/* Top-Right Corner */}
        <span
          className={`absolute -top-0.5 -right-0.5 w-5 h-5 border-t-[2.5px] border-r-[2.5px] ${reticleColor} rounded-tr-sm`}
        />
        {/* Bottom-Left Corner */}
        <span
          className={`absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-[2.5px] border-l-[2.5px] ${reticleColor} rounded-bl-sm`}
        />
        {/* Bottom-Right Corner */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-[2.5px] border-r-[2.5px] ${reticleColor} rounded-br-sm`}
        />

        {/* Center Midpoint Optical Ticks */}
        <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-[1.5px] bg-white/40" />
        <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-[1.5px] bg-white/40" />
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-[1.5px] h-1.5 bg-white/40" />
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[1.5px] h-1.5 bg-white/40" />

        {/* Inner holographic scan border when active */}
        {isScanning && (
          <div className="absolute inset-0 rounded-lg border border-cyan-400/20 bg-cyan-400/5 backdrop-blur-[1px]" />
        )}
      </div>

      {/* Floating HUD Pill / Loading State Card */}
      <div
        style={{
          left: `${pillLeft}px`,
          top: `${pillTop}px`,
          transform: 'translate(-50%, 0)',
        }}
        className="absolute z-30 pointer-events-auto transition-all duration-200"
      >
        {isScanning ? (
          /* Rich High-Tech Loading State Card */
          <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-black/85 backdrop-blur-xl border border-cyan-400/50 shadow-2xl shadow-cyan-950/80 min-w-[250px] max-w-[320px]">
            {/* Top row: Spinner + Main status + AI badge */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                <span className="text-xs font-bold text-white tracking-wide">
                  {isBarcode ? 'Decoding ISBN...' : 'Recognizing Book...'}
                </span>
              </div>
              <span className="text-[9px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-300 font-semibold border border-cyan-400/30">
                {isBarcode ? 'BARCODE' : 'AI SCAN'}
              </span>
            </div>

            {/* Middle row: Dynamic subtext describing data fetching */}
            <p className="text-[11px] text-white/75 leading-tight truncate">
              {loadingSubtexts[loadingStep]}
            </p>

            {/* Bottom row: Indeterminate animated progress shimmer */}
            <div className="flex flex-col gap-1 mt-0.5">
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full animate-shimmer-slide" />
              </div>
              <div className="flex items-center justify-between text-[9px] text-white/40 font-mono">
                <span>Hold camera steady</span>
                <span>Fetching data...</span>
              </div>
            </div>
          </div>
        ) : isLocked ? (
          /* Target Locked / Steady State Badge */
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-xl border border-emerald-400/50 text-emerald-300 shadow-xl shadow-black/80 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="font-semibold text-white/95">
              {isBarcode ? 'Barcode Targeted' : 'Book Locked'}
            </span>
            <span className="text-[10px] text-emerald-400/80 font-mono">
              Ready to scan
            </span>
          </div>
        ) : (
          /* Initial Targeting State Badge */
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white/80 shadow-lg text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
            <span>Targeting book</span>
            <span className="text-[10px] text-white/40 font-mono">Hold steady</span>
          </div>
        )}

        {/* Small arrow indicator pointing to the box */}
        <div
          className={`w-2 h-2 rotate-45 mx-auto border-r border-b backdrop-blur-xl -mt-1 transition-colors ${
            isScanning
              ? 'bg-black/85 border-cyan-400/50'
              : isLocked
                ? 'bg-black/80 border-emerald-400/50'
                : 'bg-black/70 border-white/20'
          }`}
        />
      </div>
    </div>
  )
}
