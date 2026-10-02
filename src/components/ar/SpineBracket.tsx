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
  const { currentBox, opacity, book } = item
  const isSpine = book.type === 'spine'

  const bracketColor = isWanted
    ? 'border-amber-400'
    : isSelected
      ? 'border-amber-400'
      : 'border-emerald-400/80 group-hover:border-emerald-300'

  const glowColor = isWanted
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

      {/* Spine centerline guide (subtle dashed vertical beam for shelf spine books) */}
      {isSpine && (
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
