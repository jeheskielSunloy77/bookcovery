import React from 'react'
import type { TrackedBookItem } from '../../lib/vision/tracker'
import type { DetectedBook } from '../../lib/books/types'
import type { LocalTargetState } from '../../lib/vision/local-recognizer'
import { SpineBracket } from './SpineBracket'
import { FloatingBookPill } from './FloatingBookPill'
import { LocalTargetHighlight } from './LocalTargetHighlight'

interface AROverlayProps {
  items: TrackedBookItem[]
  selectedBook: DetectedBook | null
  onSelectBook: (book: DetectedBook) => void
  localTarget?: LocalTargetState | null
  isScanning?: boolean
  containerWidth?: number
  containerHeight?: number
  videoWidth?: number
  videoHeight?: number
}

export const AROverlay: React.FC<AROverlayProps> = ({
  items,
  selectedBook,
  onSelectBook,
  localTarget,
  isScanning = false,
  containerWidth = 0,
  containerHeight = 0,
  videoWidth = 1280,
  videoHeight = 720,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {/* Real-time Local Recognition & Loading State Highlight */}
      <LocalTargetHighlight
        target={localTarget || null}
        isScanning={isScanning}
        containerWidth={containerWidth}
        containerHeight={containerHeight}
        videoWidth={videoWidth}
        videoHeight={videoHeight}
        hasDetectedBooks={items.length > 0}
      />

      {/* Persistent Resolved Detected Books */}
      {items.map((item) => {
        const isSelected = selectedBook?.id === item.book.id
        return (
          <React.Fragment key={item.id}>
            <SpineBracket item={item} isSelected={isSelected} />
            <FloatingBookPill
              item={item}
              isSelected={isSelected}
              onSelect={() => onSelectBook(item.book)}
            />
          </React.Fragment>
        )
      })}
    </div>
  )
}

