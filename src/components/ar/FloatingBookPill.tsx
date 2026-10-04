import React from 'react'
import { Star, ChevronRight, BookOpen, Target } from 'lucide-react'
import type { TrackedBookItem } from '../../lib/vision/tracker'
import { formatCompactNumber, getRatingTheme } from '../../lib/format'

interface FloatingBookPillProps {
  item: TrackedBookItem
  onSelect: (item: TrackedBookItem) => void
  isSelected: boolean
  isWanted?: boolean
}

export const FloatingBookPill: React.FC<FloatingBookPillProps> = ({
  item,
  onSelect,
  isSelected,
  isWanted = false,
}) => {
  const { book, currentBox, opacity } = item
  const rating = book.metadata?.rating
  const ratingsCount = book.metadata?.ratingsCount
  const ratingTheme = getRatingTheme(rating)

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
        transform: `translate(-50%, 0) scale(${isSelected ? 1.05 : isWanted ? 1.03 : 1})`,
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
          isWanted
            ? 'bg-amber-500/35 border-amber-400 text-white shadow-[0_0_25px_rgba(245,158,11,0.45)] ring-2 ring-amber-400/60'
            : isSelected
              ? 'bg-amber-500/25 border-amber-400/80 text-white shadow-amber-500/20'
              : 'bg-black/75 hover:bg-black/90 border-white/20 hover:border-amber-400/50 text-white shadow-black/60'
        }`}
      >
        {/* Wanted Target Pill Badge */}
        {isWanted && (
          <div className="flex items-center gap-1 bg-amber-400 text-black px-1.5 py-0.5 rounded-md font-black text-[10px] tracking-wider uppercase shadow-sm shrink-0 animate-pulse">
            <Target className="w-3 h-3 text-black stroke-[2.5]" />
            <span>WANTED</span>
          </div>
        )}

        {/* Rating Score Badge */}
        {rating ? (
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-semibold text-xs shrink-0 ${ratingTheme.bg} ${ratingTheme.border} ${ratingTheme.text}`}
          >
            <Star className={`w-3 h-3 ${ratingTheme.star}`} />
            <span>{rating.toFixed(1)}</span>
            {ratingsCount != null && ratingsCount > 0 && (
              <span className={`text-[10px] font-normal ${ratingTheme.subtext}`}>
                ({formatCompactNumber(ratingsCount)})
              </span>
            )}
          </div>
        ) : !isWanted ? (
          <div className="p-1 rounded-md bg-white/10 text-emerald-300 shrink-0">
            <BookOpen className="w-3 h-3" />
          </div>
        ) : null}

        {/* Title & Author */}
        <div className="flex flex-col max-w-[140px] sm:max-w-[200px]">
          <span
            className={`text-xs font-semibold truncate leading-tight ${
              isWanted ? 'text-amber-100 font-bold' : 'text-white/95'
            }`}
          >
            {book.title}
          </span>
          {book.author && (
            <span
              className={`text-[10px] truncate leading-tight ${
                isWanted ? 'text-amber-200/80' : 'text-white/60'
              }`}
            >
              {book.author}
            </span>
          )}
        </div>

        <ChevronRight
          className={`w-3.5 h-3.5 transition-colors shrink-0 ${
            isWanted ? 'text-amber-200 group-hover:text-white' : 'text-white/40 group-hover:text-white'
          }`}
        />
      </div>

      {/* Target indicator arrow pointer */}
      <div
        className={`w-2 h-2 rotate-45 mx-auto border-r border-b backdrop-blur-xl -mt-1 transition-colors ${
          isWanted
            ? 'bg-amber-500/40 border-amber-400'
            : isSelected
              ? 'bg-amber-500/25 border-amber-400/80'
              : 'bg-black/75 border-white/20'
        }`}
      />
    </button>
  )
}
