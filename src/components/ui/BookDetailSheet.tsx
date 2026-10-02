import React from 'react'
import {
  X,
  Star,
  Calendar,
  BookOpen,
  ExternalLink,
  Sparkles,
  History,
  CheckCircle2,
  Target,
  Database,
} from 'lucide-react'
import type { DetectedBook } from '../../lib/books/types'
import { useScannerStore } from '../../lib/store/scanner-store'
import { cleanIsbn } from '../../lib/books/matcher'

interface BookDetailSheetProps {
  book: DetectedBook | null
  onClose: () => void
  store: ReturnType<typeof useScannerStore>
}

export const BookDetailSheet: React.FC<BookDetailSheetProps> = ({
  book,
  onClose,
  store,
}) => {
  if (!book) return null

  const metadata = book.metadata
  const rating = metadata?.rating
  const isRecorded = store.isBookInHistory(book) || (metadata ? store.isBookInHistory(metadata) : false)
  const matchedWanted =
    store.getMatchingWantedItem(book) || (metadata ? store.getMatchingWantedItem(metadata) : undefined)
  const isWanted = !!matchedWanted

  // Calculate rating breakdown percentages if available
  const breakdown = metadata?.ratingsBreakdown
  const totalCount = metadata?.ratingsCount || 0

  return (
    <div
      style={{
        paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))',
      }}
      className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6 flex justify-center pointer-events-none animate-in fade-in slide-from-bottom-8 duration-300"
    >
      <div className="w-full max-w-xl bg-[#0d121c]/95 border border-white/15 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-black/80 overflow-hidden pointer-events-auto flex flex-col max-h-[82vh]">
        {/* Drag handle / Top bar */}
        <div className="relative pt-3 pb-2 px-6 flex items-center justify-between border-b border-white/5">
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2.5" />
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] font-medium tracking-wider uppercase text-amber-400/90 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Book Details
            </span>
            {isRecorded && (
              <span className="text-[10px] bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                In History
              </span>
            )}
            {isWanted && (
              <span className="text-[10px] bg-amber-500/20 border border-amber-400/40 text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                <Target className="w-3 h-3 text-amber-400" />
                On Wanted List
              </span>
            )}
            {metadata?.sources && metadata.sources.length > 0 ? (
              metadata.sources.map((src) => (
                <span
                  key={src}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    src === 'google-books'
                      ? 'bg-blue-500/15 border border-blue-400/30 text-blue-300'
                      : src === 'open-library'
                        ? 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-300'
                        : 'bg-white/10 text-white/70'
                  }`}
                >
                  {src === 'google-books'
                    ? 'Google Books'
                    : src === 'open-library'
                      ? 'Open Library'
                      : 'AI Identified'}
                </span>
              ))
            ) : metadata?.source ? (
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-white/60">
                {metadata.source === 'open-library'
                  ? 'Open Library'
                  : metadata.source === 'google-books'
                    ? 'Google Books'
                    : 'AI Identified'}
              </span>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors mt-2"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Header Row: Cover + Title + Author + Rating */}
          <div className="flex gap-5">
            {/* Book Cover */}
            <div className="shrink-0 w-24 sm:w-28 h-36 sm:h-40 rounded-xl overflow-hidden bg-neutral-900 border border-white/10 shadow-lg relative group">
              {metadata?.coverUrl ? (
                <img
                  src={metadata.coverUrl}
                  alt={metadata.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    // Fallback to placeholder if cover image fails
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                  <BookOpen className="w-8 h-8 text-white/30 mb-2" />
                  <span className="text-[10px] text-white/40 uppercase tracking-wider font-mono">
                    No Cover
                  </span>
                </div>
              )}
            </div>

            {/* Title, Author, Quick Stats */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                  {book.title}
                </h2>
                <p className="text-sm text-neutral-300 mt-1 font-medium">
                  {book.author || 'Unknown Author'}
                </p>

                {/* Rating badge & Review counts */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {rating ? (
                    <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 rounded-xl text-amber-300">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-bold">{rating.toFixed(1)}</span>
                      <span className="text-xs text-amber-300/70">/ 5</span>
                    </div>
                  ) : (
                    <div className="text-xs text-white/40 italic">Rating pending</div>
                  )}

                  {totalCount > 0 && (
                    <span className="text-xs text-white/50">
                      ({totalCount.toLocaleString()} reviews)
                    </span>
                  )}
                </div>
              </div>

              {/* Meta pills: year, pages */}
              <div className="flex items-center gap-3 text-xs text-white/60 mt-3 pt-3 border-t border-white/5">
                {metadata?.publishedYear && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-white/40" />
                    <span>{metadata.publishedYear}</span>
                  </div>
                )}
                {metadata?.pageCount && (
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-white/40" />
                    <span>{metadata.pageCount} pages</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Genre Tags */}
          {metadata?.genres && metadata.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {metadata.genres.map((genre) => (
                <span
                  key={genre}
                  className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/80"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {/* Rating Distribution (if breakdown available) */}
          {breakdown && totalCount > 0 && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2">
              <span className="text-xs font-semibold text-white/70 block">
                Rating Distribution
              </span>
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = breakdown[stars as keyof typeof breakdown] || 0
                const percent = Math.round((count / totalCount) * 100) || 0
                return (
                  <div key={stars} className="flex items-center gap-3 text-xs text-white/60">
                    <span className="w-3 font-mono">{stars}★</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-[11px] text-white/40">{percent}%</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Synopsis / Hook */}
          {metadata?.synopsis && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">
                Synopsis & Reader Hook
              </h3>
              <p className="text-sm text-neutral-300 leading-relaxed font-normal line-clamp-4">
                {metadata.synopsis}
              </p>
            </div>
          )}

          {/* Data Sources Details */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white/60 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                Data Sources
              </span>
              {metadata?.isbn && (
                <span className="text-[11px] font-mono text-white/60 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                  ISBN: {cleanIsbn(metadata.isbn)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Google Books Source */}
              {(metadata?.sources?.includes('google-books') || metadata?.source === 'google-books') && (
                <a
                  href={`https://books.google.com/books?q=${encodeURIComponent(`${book.title} ${book.author || ''}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/10 border border-blue-400/20 text-blue-200 hover:bg-blue-500/15 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white group-hover:text-blue-200">Google Books</div>
                      <div className="text-[10px] text-white/50">Synopsis, categories & ratings</div>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400/60 group-hover:text-blue-300 shrink-0" />
                </a>
              )}

              {/* Open Library Source */}
              {(metadata?.sources?.includes('open-library') || metadata?.source === 'open-library') && (
                <a
                  href={
                    metadata?.isbn
                      ? `https://openlibrary.org/isbn/${cleanIsbn(metadata.isbn)}`
                      : `https://openlibrary.org/search?q=${encodeURIComponent(book.title)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/20 text-emerald-200 hover:bg-emerald-500/15 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white group-hover:text-emerald-200">Open Library</div>
                      <div className="text-[10px] text-white/50">Community reviews & cover</div>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400/60 group-hover:text-emerald-300 shrink-0" />
                </a>
              )}

              {/* Camera Vision AI */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-white">Camera Vision</div>
                    <div className="text-[10px] text-white/50">
                      {book.confidence ? `${Math.round(book.confidence * 100)}% detection confidence` : 'Gemini 2.5 Flash spine OCR'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => {
                if (matchedWanted) {
                  store.removeWantedBook(matchedWanted.id)
                } else {
                  store.addWantedBook({
                    title: book.title,
                    author: book.author,
                    isbn: metadata?.isbn,
                    coverUrl: metadata?.coverUrl,
                  })
                }
              }}
              className={`flex-1 py-3 px-4 rounded-2xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                isWanted
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/40 text-amber-300'
                  : 'bg-white/10 hover:bg-white/15 border-white/10 text-white'
              }`}
            >
              <Target className={`w-4 h-4 ${isWanted ? 'text-amber-400' : 'text-white/60'}`} />
              <span>{isWanted ? 'On Wanted List' : '+ Add to Wanted'}</span>
            </button>

            <button
              onClick={() => {
                onClose()
                store.setIsHistoryOpen(true)
              }}
              className="flex-1 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <History className="w-4 h-4 text-amber-400" />
              <span>View History</span>
            </button>

            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${book.title} ${book.author || ''} book reviews`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 px-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <span>Reviews</span>
              <ExternalLink className="w-4 h-4 text-amber-300/80" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
