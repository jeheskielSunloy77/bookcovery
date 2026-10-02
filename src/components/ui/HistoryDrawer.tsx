import React, { useState, useMemo } from 'react'
import {
  X,
  Trash2,
  Download,
  BookOpen,
  Star,
  ExternalLink,
  History,
  Search,
  Clock,
} from 'lucide-react'
import { useScannerStore } from '../../lib/store/scanner-store'
import type { HistoryBookRecord, DetectedBook } from '../../lib/books/types'

interface HistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  store: ReturnType<typeof useScannerStore>
}

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return ''
  const diffMs = Date.now() - timestamp
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  store,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  const books: HistoryBookRecord[] = store.historyBooks

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return books
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.genres?.some((g) => g.toLowerCase().includes(q))
    )
  }, [books, searchQuery])

  if (!isOpen) return null

  const handleExport = () => {
    const markdown = [
      '# Bookcovery Scan History',
      `Exported: ${new Date().toLocaleString()}`,
      `Total Recorded Books: ${books.length}`,
      '',
      ...books.map(
        (b) =>
          `- **${b.title}** by ${b.author}${b.rating ? ` — ★ ${b.rating.toFixed(1)}/5` : ''}${b.publishedYear ? ` (${b.publishedYear})` : ''}${b.recordedAt ? ` [Scanned: ${new Date(b.recordedAt).toLocaleString()}]` : ''}`
      ),
    ].join('\n')

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookcovery-history-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOpenDetail = (b: HistoryBookRecord) => {
    const detected: DetectedBook = {
      id: b.id,
      title: b.title,
      author: b.author,
      type: 'spine',
      box2d: [0, 0, 0, 0],
      confidence: 1,
      metadata: b,
      lastSeenTimestamp: b.recordedAt || Date.now(),
    }
    store.setSelectedBook(detected)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Scrim */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-[#0a0e17] border-l border-white/10 h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div
          style={{
            paddingTop: 'max(1.25rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))',
          }}
          className="p-5 border-b border-white/10 flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Scan History</h2>
              <p className="text-xs text-white/50">
                {books.length} {books.length === 1 ? 'book' : 'books'} recorded locally
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        {books.length > 0 && (
          <div className="p-4 border-b border-white/5 bg-white/[0.02] space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recorded books..."
                className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Actions: Export & Clear */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleExport}
                className="text-xs font-medium text-amber-400/90 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export as Markdown</span>
              </button>

              {confirmClear ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-red-400">Clear all?</span>
                  <button
                    onClick={() => {
                      store.clearHistory()
                      setConfirmClear(false)
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-white/10 text-white/70 hover:bg-white/20"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="text-xs font-medium text-white/40 hover:text-red-400 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear History</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* List */}
        <div
          style={{
            paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem))',
          }}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3"
        >
          {books.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/40">
              <History className="w-12 h-12 mb-3 stroke-[1.2] text-white/20" />
              <p className="text-sm font-medium text-white/70">No scan history yet</p>
              <p className="text-xs text-white/40 mt-1 max-w-[240px]">
                Aim the camera at book spines or covers to scan. All recorded books will automatically be saved here locally.
              </p>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-white/40">
              <Search className="w-8 h-8 mb-2 stroke-[1.2] text-white/20" />
              <p className="text-xs font-medium text-white/60">No books matching "{searchQuery}"</p>
            </div>
          ) : (
            filteredBooks.map((b) => (
              <div
                key={b.id}
                onClick={() => handleOpenDetail(b)}
                className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3.5 hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className="w-12 h-16 rounded-lg bg-neutral-800 shrink-0 overflow-hidden border border-white/10 flex items-center justify-center relative">
                  {b.coverUrl ? (
                    <img
                      src={b.coverUrl}
                      alt={b.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        ;(e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <BookOpen className="w-4 h-4 text-white/30" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-semibold text-white truncate group-hover:text-amber-300 transition-colors">
                      {b.title}
                    </h4>
                  </div>
                  <p className="text-xs text-white/50 truncate mt-0.5">{b.author}</p>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {b.rating && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-400/30 px-1.5 py-0.5 rounded-md">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        {b.rating.toFixed(1)}
                      </span>
                    )}
                    {b.publishedYear && (
                      <span className="text-[10px] text-white/40">{b.publishedYear}</span>
                    )}
                    {b.recordedAt && (
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <Clock className="w-2.5 h-2.5" />
                        {formatRelativeTime(b.recordedAt)}
                      </span>
                    )}
                    {b.scanCount && b.scanCount > 1 && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-400/20 px-1 rounded">
                        {b.scanCount}x
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(`${b.title} ${b.author} book`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-white/40 hover:text-white transition-colors"
                    title="Search online"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => store.removeHistoryBook(b.id)}
                    className="p-2 text-white/40 hover:text-red-400 transition-colors"
                    title="Remove from history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
