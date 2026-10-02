import React from 'react'
import type { TrackedBookItem } from '../../lib/vision/tracker'
import type { DetectedBook } from '../../lib/books/types'
import { SpineBracket } from './SpineBracket'
import { FloatingBookPill } from './FloatingBookPill'

interface AROverlayProps {
  items: TrackedBookItem[]
  selectedBook: DetectedBook | null
  onSelectBook: (book: DetectedBook) => void
  isBookWanted?: (book: { title: string; author?: string; isbn?: string }) => boolean
}

export const AROverlay: React.FC<AROverlayProps> = ({
  items,
  selectedBook,
  onSelectBook,
  isBookWanted,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {/* Persistent Resolved Detected Books */}
      {items.map((item) => {
        const isSelected = selectedBook?.id === item.book.id
        const isWanted = isBookWanted ? isBookWanted(item.book) : false
        return (
          <React.Fragment key={item.id}>
            <SpineBracket item={item} isSelected={isSelected} isWanted={isWanted} />
            <FloatingBookPill
              item={item}
              isSelected={isSelected}
              isWanted={isWanted}
              onSelect={() => onSelectBook(item.book)}
            />
          </React.Fragment>
        )
      })}
    </div>
  )
}
