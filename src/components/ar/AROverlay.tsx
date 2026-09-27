import React from 'react'
import type { TrackedBookItem } from '../../lib/vision/tracker'
import type { DetectedBook } from '../../lib/books/types'
import { SpineBracket } from './SpineBracket'
import { FloatingBookPill } from './FloatingBookPill'

interface AROverlayProps {
  items: TrackedBookItem[]
  selectedBook: DetectedBook | null
  onSelectBook: (book: DetectedBook) => void
}

export const AROverlay: React.FC<AROverlayProps> = ({
  items,
  selectedBook,
  onSelectBook,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
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
