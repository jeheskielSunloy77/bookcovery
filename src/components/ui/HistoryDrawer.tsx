import React, { useState, useMemo, useEffect, useRef } from 'react'
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
  Target,
  Plus,
  FileCode,
  Bookmark,
  Sparkles,
} from 'lucide-react'
import { useScannerStore } from '../../lib/store/scanner-store'
import type { HistoryBookRecord, DetectedBook, WantedBookItem } from '../../lib/books/types'
import { BatchImportModal } from './BatchImportModal'
import { enrichBookMetadataFn } from '../../lib/server/scan'
import { formatCompactNumber } from '../../lib/format'

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
  const [activeTab, setActiveTab] = useState<'history' | 'wanted'>('history')
  const [searchQuery, setSearchQuery] = useState('')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'wanted-only'>('all')
  const [confirmClearHistory, setConfirmClearHistory] = useState(false)
  const [confirmClearWanted, setConfirmClearWanted] = useState(false)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)

  // Quick Add input state
  const [newTitle, setNewTitle] = useState('')
  const [newAuthor, setNewAuthor] = useState('')
  const [addFeedback, setAddFeedback] = useState<string | null>(null)
  const attemptedEnrichIds = useRef<Set<string>>(new Set())

  const historyBooks: HistoryBookRecord[] = store.historyBooks
  const wantedBooks: WantedBookItem[] = store.wantedBooks

  // Map of which history book IDs match wanted books
  const wantedMatchedHistoryBookIds = useMemo(() => {
    const ids = new Set<string>()
    for (const hb of historyBooks) {
      if (store.isBookWanted(hb)) {
        ids.add(hb.id)
      }
    }
    return ids
  }, [historyBooks, store])

  // Automatically fetch missing covers for wanted books in background
  useEffect(() => {
    if (!isOpen || activeTab !== 'wanted') return

    wantedBooks.forEach((item) => {
      if (item.coverUrl || attemptedEnrichIds.current.has(item.id)) return
      attemptedEnrichIds.current.add(item.id)

      // First check if a recorded book in history matches and has a cover
      const matchedHistory = historyBooks.find(
        (hb) =>
          hb.coverUrl &&
          hb.title &&
          item.title &&
          hb.title.trim().toLowerCase() === item.title.trim().toLowerCase()
      )
      if (matchedHistory?.coverUrl) {
        store.updateWantedBook(item.id, { coverUrl: matchedHistory.coverUrl })
        return
      }

      // Fetch cover via enrichBookMetadataFn
      enrichBookMetadataFn({
        data: {
          bookId: item.id,
          title: item.title,
          author: item.author,
          isbn: item.isbn,
        },
      })
        .then((res) => {
          if (res?.metadata?.coverUrl) {
            store.updateWantedBook(item.id, { coverUrl: res.metadata.coverUrl })
          }
        })
        .catch(() => {
          if (item.isbn) {
            const clean = item.isbn.replace(/[-\s]/g, '')
            store.updateWantedBook(item.id, {
              coverUrl: `https://covers.openlibrary.org/b/isbn/${clean}-M.jpg`,
            })
          }
        })
    })
  }, [isOpen, activeTab, wantedBooks, historyBooks, store])

  // Filtered History Books
  const filteredHistoryBooks = useMemo(() => {
    let list = historyBooks
    if (historyFilter === 'wanted-only') {
      list = list.filter((b) => wantedMatchedHistoryBookIds.has(b.id))
    }
    const q = searchQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.genres?.some((g) => g.toLowerCase().includes(q))
    )
  }, [historyBooks, historyFilter, wantedMatchedHistoryBookIds, searchQuery])

  // Filtered Wanted Books
  const filteredWantedBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return wantedBooks
    return wantedBooks.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        (w.author && w.author.toLowerCase().includes(q)) ||
        (w.notes && w.notes.toLowerCase().includes(q))
    )
  }, [wantedBooks, searchQuery])

  if (!isOpen) return null

  const handleExportHistory = () => {
    const markdown = [
      '# Bookcovery Scan History',
      `Exported: ${new Date().toLocaleString()}`,
      `Total Recorded Books: ${historyBooks.length}`,
      '',
      ...historyBooks.map(
        (b) =>
          `- **${b.title}** by ${b.author}${
            wantedMatchedHistoryBookIds.has(b.id) ? ' [🎯 WANTED MATCH]' : ''
          }${b.rating ? ` — ★ ${b.rating.toFixed(1)}/5` : ''}${
            b.ratingsCount ? ` (${b.ratingsCount.toLocaleString()} reviews)` : ''
          }${
            b.publishedYear ? ` (${b.publishedYear})` : ''
          }${b.recordedAt ? ` [Scanned: ${new Date(b.recordedAt).toLocaleString()}]` : ''}`
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

  const handleAddQuickBook = (e: React.FormEvent) => {
    e.preventDefault()
    const title = newTitle.trim()
    const author = newAuthor.trim() || undefined
    if (!title) return

    try {
      const added = store.addWantedBook({
        title,
        author,
      })
      setNewTitle('')
      setNewAuthor('')
      setAddFeedback(`Added "${added.title}" to Wanted List!`)
      setTimeout(() => setAddFeedback(null), 2500)

      if (!added.coverUrl) {
        enrichBookMetadataFn({
          data: {
            bookId: added.id,
            title: added.title,
            author: added.author,
          },
        })
          .then((res) => {
            if (res?.metadata?.coverUrl) {
              store.updateWantedBook(added.id, {
                coverUrl: res.metadata.coverUrl,
              })
            }
          })
          .catch(() => {})
      }
    } catch (err) {
      setAddFeedback((err as Error).message)
      setTimeout(() => setAddFeedback(null), 2000)
    }
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
          className="p-5 border-b border-white/10 space-y-4"
        >
          {/* Top Title & Close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-400">
                {activeTab === 'history' ? (
                  <History className="w-5 h-5" />
                ) : (
                  <Target className="w-5 h-5" />
                )}
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {activeTab === 'history' ? 'Scan History' : 'Wanted List'}
                </h2>
                <p className="text-xs text-white/50">
                  {activeTab === 'history'
                    ? `${historyBooks.length} recorded ${historyBooks.length === 1 ? 'book' : 'books'} ${
                        wantedMatchedHistoryBookIds.size > 0
                          ? `(${wantedMatchedHistoryBookIds.size} wanted)`
                          : ''
                      }`
                    : `${wantedBooks.length} ${wantedBooks.length === 1 ? 'wanted book' : 'wanted books'}`}
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

          {/* Segmented Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-white/5 border border-white/10 rounded-2xl">
            <button
              onClick={() => {
                setActiveTab('history')
                setSearchQuery('')
              }}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'history'
                  ? 'bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'history'
                    ? 'bg-black/20 text-black'
                    : 'bg-white/10 text-white/60'
                }`}
              >
                {historyBooks.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('wanted')
                setSearchQuery('')
              }}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'wanted'
                  ? 'bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Wanted List</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'wanted'
                    ? 'bg-black/20 text-black'
                    : 'bg-white/10 text-white/60'
                }`}
              >
                {wantedBooks.length}
              </span>
            </button>
          </div>
        </div>

        {/* TAB 1: SCAN HISTORY */}
        {activeTab === 'history' && (
          <>
            {/* Search & Actions Bar */}
            {historyBooks.length > 0 && (
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

                {/* Filter Pills & Actions */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Filter chips */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setHistoryFilter('all')}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                        historyFilter === 'all'
                          ? 'bg-white/15 border-white/20 text-white font-medium'
                          : 'bg-transparent border-transparent text-white/50 hover:text-white'
                      }`}
                    >
                      All ({historyBooks.length})
                    </button>
                    {wantedMatchedHistoryBookIds.size > 0 && (
                      <button
                        onClick={() => setHistoryFilter('wanted-only')}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all ${
                          historyFilter === 'wanted-only'
                            ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 font-semibold'
                            : 'bg-transparent border-transparent text-amber-400/70 hover:text-amber-300'
                        }`}
                      >
                        <Target className="w-3 h-3 text-amber-400" />
                        <span>Wanted ({wantedMatchedHistoryBookIds.size})</span>
                      </button>
                    )}
                  </div>

                  {/* Actions: Export & Clear */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleExportHistory}
                      className="text-xs font-medium text-amber-400/90 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
                      title="Export history as markdown file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export</span>
                    </button>

                    {confirmClearHistory ? (
                      <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-xl animate-in fade-in">
                        <span className="text-[11px] font-medium text-red-300">
                          Delete all {historyBooks.length}?
                        </span>
                        <button
                          onClick={() => {
                            store.clearHistory()
                            setConfirmClearHistory(false)
                          }}
                          className="text-[11px] px-2 py-0.5 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-sm"
                        >
                          Delete All
                        </button>
                        <button
                          onClick={() => setConfirmClearHistory(false)}
                          className="text-[11px] px-2 py-0.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmClearHistory(true)}
                        className="text-xs font-semibold text-red-400/80 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1 rounded-xl border border-red-500/20 flex items-center gap-1.5 transition-all"
                        title="Delete all recorded scan history"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>Delete All History</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* History List */}
            <div
              style={{
                paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem))',
              }}
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3"
            >
              {historyBooks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/40">
                  <History className="w-12 h-12 mb-3 stroke-[1.2] text-white/20" />
                  <p className="text-sm font-medium text-white/70">No scan history yet</p>
                  <p className="text-xs text-white/40 mt-1 max-w-[240px]">
                    Aim the camera at book spines or covers to scan. All recorded books will automatically be saved here.
                  </p>
                </div>
              ) : filteredHistoryBooks.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-white/40">
                  <Search className="w-8 h-8 mb-2 stroke-[1.2] text-white/20" />
                  <p className="text-xs font-medium text-white/60">
                    {historyFilter === 'wanted-only'
                      ? 'No scanned books matching your wanted list yet'
                      : `No books matching "${searchQuery}"`}
                  </p>
                </div>
              ) : (
                filteredHistoryBooks.map((b) => {
                  const isWanted = wantedMatchedHistoryBookIds.has(b.id)
                  return (
                    <div
                      key={b.id}
                      onClick={() => handleOpenDetail(b)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer group relative ${
                        isWanted
                          ? 'bg-gradient-to-r from-amber-500/15 via-white/[0.06] to-white/[0.02] border-amber-400/60 shadow-[0_0_18px_rgba(245,158,11,0.12)] hover:border-amber-300'
                          : 'bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
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
                          {/* Wanted Highlight Badge */}
                          {isWanted && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/25 border border-amber-400/40 px-2 py-0.5 rounded-full mb-1">
                              <Target className="w-3 h-3 text-amber-400" />
                              <span>Wanted Match</span>
                            </div>
                          )}

                          <h4
                            className={`text-sm font-semibold truncate transition-colors ${
                              isWanted
                                ? 'text-amber-200 group-hover:text-amber-100 font-bold'
                                : 'text-white group-hover:text-amber-300'
                            }`}
                          >
                            {b.title}
                          </h4>
                          <p className="text-xs text-white/50 truncate mt-0.5">{b.author}</p>

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {b.rating && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-400/30 px-1.5 py-0.5 rounded-md">
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                <span>{b.rating.toFixed(1)}</span>
                                {b.ratingsCount != null && b.ratingsCount > 0 && (
                                  <span className="text-[9px] text-amber-300/70 font-normal">
                                    ({formatCompactNumber(b.ratingsCount)})
                                  </span>
                                )}
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
                            {b.source && (
                              <span className="text-[10px] text-white/40 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                                {b.source === 'google-books'
                                  ? 'Google Books'
                                  : b.source === 'open-library'
                                    ? 'Open Library'
                                    : 'AI'}
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
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {/* TAB 2: WANTED LIST */}
        {activeTab === 'wanted' && (
          <>
            {/* Quick Add Form & Action Controls */}
            <div className="p-4 border-b border-white/10 bg-white/[0.02] space-y-3">
              {/* Inline Quick Add Form */}
              <form onSubmit={handleAddQuickBook} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Book title to find..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400/60"
                  />
                  <input
                    type="text"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    placeholder="Author (opt)..."
                    className="w-28 sm:w-32 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400/60"
                  />
                  <button
                    type="submit"
                    disabled={!newTitle.trim()}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 active:scale-95"
                    title="Add book to Wanted List"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </form>

              {addFeedback && (
                <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{addFeedback}</span>
                </div>
              )}

              {/* Action Buttons: Batch JSON Import & Clear */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                <button
                  onClick={() => setIsBatchModalOpen(true)}
                  className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Batch Add via JSON</span>
                </button>

                {wantedBooks.length > 0 &&
                  (confirmClearWanted ? (
                    <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-xl animate-in fade-in">
                      <span className="text-[11px] font-medium text-red-300">
                        Delete all {wantedBooks.length} wanted?
                      </span>
                      <button
                        onClick={() => {
                          store.clearWantedBooks()
                          setConfirmClearWanted(false)
                        }}
                        className="text-[11px] px-2 py-0.5 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-sm"
                      >
                        Delete All
                      </button>
                      <button
                        onClick={() => setConfirmClearWanted(false)}
                        className="text-[11px] px-2 py-0.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmClearWanted(true)}
                      className="text-xs font-semibold text-red-400/80 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1 rounded-xl border border-red-500/20 flex items-center gap-1.5 transition-all"
                      title="Delete all wanted books"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Delete All Wanted</span>
                    </button>
                  ))}
              </div>

              {/* Search Bar if items exist */}
              {wantedBooks.length > 0 && (
                <div className="relative pt-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search wanted list..."
                    className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400/50"
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
              )}
            </div>

            {/* Wanted List */}
            <div
              style={{
                paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem))',
              }}
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3"
            >
              {wantedBooks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/40">
                  <Bookmark className="w-12 h-12 mb-3 stroke-[1.2] text-white/20" />
                  <p className="text-sm font-medium text-white/70">Your Wanted List is empty</p>
                  <p className="text-xs text-white/40 mt-1 max-w-[260px]">
                    Add books you want to find above or import a JSON list. When scanned by the camera, they will be highlighted!
                  </p>
                  <button
                    onClick={() => setIsBatchModalOpen(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-all flex items-center gap-1.5"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Try Batch Import Example</span>
                  </button>
                </div>
              ) : filteredWantedBooks.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-white/40">
                  <Search className="w-8 h-8 mb-2 stroke-[1.2] text-white/20" />
                  <p className="text-xs font-medium text-white/60">
                    No books matching "{searchQuery}"
                  </p>
                </div>
              ) : (
                filteredWantedBooks.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-white/20 transition-all relative group"
                  >
                    <div className="flex items-center gap-3.5">
                      {/* Book Cover Thumbnail */}
                      <div className="w-12 h-16 rounded-lg bg-neutral-800 shrink-0 overflow-hidden border border-white/10 flex items-center justify-center relative">
                        <BookOpen className="w-4 h-4 text-white/30 absolute" />
                        {item.coverUrl && (
                          <img
                            src={item.coverUrl}
                            alt={item.title}
                            className="w-full h-full object-cover relative z-10 group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              ;(e.target as HTMLElement).style.display = 'none'
                            }}
                          />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate text-white group-hover:text-amber-300 transition-colors">
                          {item.title}
                        </h4>
                        {item.author && (
                          <p className="text-xs text-white/50 truncate mt-0.5">{item.author}</p>
                        )}

                        {item.notes && (
                          <p className="text-[11px] text-white/40 mt-1 italic line-clamp-2">
                            "{item.notes}"
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {item.addedAt && (
                            <span className="flex items-center gap-1 text-[10px] text-white/40">
                              <Clock className="w-2.5 h-2.5" />
                              Added {formatRelativeTime(item.addedAt)}
                            </span>
                          )}
                          {item.isbn && (
                            <span className="text-[10px] font-mono text-white/30">
                              ISBN: {item.isbn}
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
                          href={`https://www.google.com/search?q=${encodeURIComponent(`${item.title} ${item.author || ''} book`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-white/40 hover:text-white transition-colors"
                          title="Search online"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => store.removeWantedBook(item.id)}
                          className="p-2 text-white/40 hover:text-red-400 transition-colors"
                          title="Remove from Wanted List"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Batch Import Modal */}
      <BatchImportModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onImport={(items) => store.batchAddWantedBooks(items)}
      />
    </div>
  )
}
