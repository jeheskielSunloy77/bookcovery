import React from 'react'
import { Star, ChevronRight, BookOpen } from 'lucide-react'
import type { TrackedBookItem } from '../../lib/vision/tracker'

interface FloatingBookPillProps {
  item: TrackedBookItem
  onSelect: (item: TrackedBookItem) => void
  isSelected: boolean
}

export const FloatingBookPill: React.FC<FloatingBookPillProps> = ({
  item,
  onSelect,
  isSelected,
}) => {
  const { book, currentBox, opacity } = item
  const rating = book.metadata?.rating

  // Calculate pill position: place directly above or below the book box
  const pillLeft = currentBox.centerX
  const pillTop = currentBox.top > 80 ? currentBox.top - 48 : currentBox.top + currentBox.height + 12

  return (
    <button
      type="button"
      style={{
        left: `${pillLeft}px`,
        top: `${pillTop}px`,
        opacity,
        transform: `translate(-50%, 0) scale(${isSelected ? 1.05 : 1})`,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(item)
      }}
      aria-label={`Inspect book: ${book.title}`}
      className="absolute z-30 cursor-pointer pointer-events-auto transition-transform duration-200 select-none group text-left p-0 bg-transparent border-none outline-none focus:ring-2 focus:ring-amber-400 rounded-full"
    >
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-xl shadow-2xl transition-all duration-300 ${
          isSelected
            ? 'bg-amber-500/25 border-amber-400/80 text-white shadow-amber-500/20'
            : 'bg-black/75 hover:bg-black/90 border-white/20 hover:border-amber-400/50 text-white shadow-black/60'
        }`}
      >
        {/* Rating or Book Icon */}
        <div className="flex items-center gap-1 shrink-0">
          {rating ? (
            <div className="flex items-center gap-1 bg-amber-500/20 px-1.5 py-0.5 rounded-md border border-amber-400/30 text-amber-300 font-semibold text-xs">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{rating.toFixed(1)}</span>
            </div>
          ) : (
            <div className="p-1 rounded-md bg-white/10 text-emerald-300">
              <BookOpen className="w-3 h-3" />
            </div>
          )}
        </div>

        {/* Title & Author */}
        <div className="flex flex-col max-w-[140px] sm:max-w-[200px]">
          <span className="text-xs font-semibold text-white/95 truncate leading-tight">
            {book.title}
          </span>
          {book.author && (
            <span className="text-[10px] text-white/60 truncate leading-tight">
              {book.author}
            </span>
          )}
        </div>

        <ChevronRight className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors shrink-0" />
      </div>

      {/* Target indicator arrow pointer */}
      <div
        className={`w-2 h-2 rotate-45 mx-auto border-r border-b backdrop-blur-xl -mt-1 transition-colors ${
          isSelected
            ? 'bg-amber-500/25 border-amber-400/80'
            : 'bg-black/75 border-white/20'
        }`}
      />
    </button>
  )
}
