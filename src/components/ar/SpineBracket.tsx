import React from 'react'
import type { TrackedBookItem } from '../../lib/vision/tracker'

interface SpineBracketProps {
  item: TrackedBookItem
  isSelected: boolean
  isWanted?: boolean
}

export const SpineBracket: React.FC<SpineBracketProps> = ({
  item,
  isSelected,
  isWanted = false,
}) => {
  const isPending = book.isPendingAnalysis
  const isSpine = book.type === 'spine'

  const bracketColor = isPending
    ? 'border-amber-400 animate-pulse'
    : isWanted
      ? 'border-amber-400'
      : isSelected
        ? 'border-amber-400'
        : 'border-emerald-400/80 group-hover:border-emerald-300'

  const glowColor = isPending
    ? 'rgba(245, 158, 11, 0.5)'
    : isWanted
      ? 'rgba(245, 158, 11, 0.45)'
      : isSelected
        ? 'rgba(245, 158, 11, 0.25)'
        : 'rgba(16, 185, 129, 0.12)'

  return (
    <div
      style={{
        left: `${currentBox.left}px`,
        top: `${currentBox.top}px`,
        width: `${currentBox.width}px`,
        height: `${currentBox.height}px`,
        opacity,
        boxShadow: `0 0 18px ${glowColor}`,
      }}
      className={`absolute z-20 pointer-events-none transition-all duration-150 rounded-sm`}
    >
      {/* 4 Corner reticle marks */}
      {/* Top Left */}
      <span
        className={`absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 ${bracketColor} rounded-tl-sm`}
      />
      {/* Top Right */}
      <span
        className={`absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 ${bracketColor} rounded-tr-sm`}
      />
      {/* Bottom Left */}
      <span
        className={`absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 ${bracketColor} rounded-bl-sm`}
      />
      {/* Bottom Right */}
      <span
        className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 ${bracketColor} rounded-br-sm`}
      />

      {/* Scanning laser beam indicator during AI analysis */}
      {isPending && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_12px_rgba(245,158,11,0.9)] animate-pulse" />
      )}

      {/* Spine centerline guide (subtle dashed vertical beam for shelf spine books) */}
      {isSpine && !isPending && (
        <div
          className={`absolute inset-y-2 left-1/2 -translate-x-1/2 w-[1px] bg-gradient-to-b ${
            isWanted
              ? 'from-transparent via-amber-400/50 to-transparent'
              : 'from-transparent via-emerald-400/30 to-transparent'
          }`}
        />
      )}
    </div>
  )
}
