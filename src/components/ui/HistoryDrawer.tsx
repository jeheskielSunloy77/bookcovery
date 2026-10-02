import React from 'react'
import {
  X,
  Trash2,
  Download,
  BookOpen,
  Star,
  ExternalLink,
  Library,
} from 'lucide-react'
import { useScannerStore } from '../../lib/store/scanner-store'

interface HistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  store: ReturnType<typeof useScannerStore>
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  store,
}) => {
  if (!isOpen) return null

  const books = store.savedBooks

  const handleExport = () => {
    const markdown = [
      '# My Scanned Bookshelf (Bookcovery)',
      `Exported: ${new Date().toLocaleDateString()}`,
      '',
      ...books.map(
        (b) =>
          `- **${b.title}** by ${b.author}${b.rating ? ` — ★ ${b.rating.toFixed(1)}/5` : ''}${b.publishedYear ? ` (${b.publishedYear})` : ''}`
      ),
    ].join('\n')

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookcovery-shelf-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
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
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-400">
              <Library className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Saved Bookshelf</h2>
              <p className="text-xs text-white/50">{books.length} books scanned & saved</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action bar if items exist */}
        {books.length > 0 && (
          <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <button
              onClick={handleExport}
              className="text-xs font-medium text-amber-400/90 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export as Markdown</span>
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {books.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/40">
              <BookOpen className="w-12 h-12 mb-3 stroke-[1.2] text-white/20" />
              <p className="text-sm font-medium text-white/70">No saved books yet</p>
              <p className="text-xs text-white/40 mt-1 max-w-[220px]">
                Scan book spines or covers with the camera and tap "Save to Bookshelf" to collect them here.
              </p>
            </div>
          ) : (
            books.map((b) => (
              <div
                key={b.id}
                className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3.5 hover:bg-white/[0.07] transition-all group"
              >
                {/* Thumbnail */}
                <div className="w-12 h-16 rounded-lg bg-neutral-800 shrink-0 overflow-hidden border border-white/10 flex items-center justify-center">
                  {b.coverUrl ? (
                    <img
                      src={b.coverUrl}
                      alt={b.title}
                      className="w-full h-full object-cover"
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
                  <h4 className="text-sm font-semibold text-white truncate">{b.title}</h4>
                  <p className="text-xs text-white/50 truncate mt-0.5">{b.author}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {b.rating && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/20 border border-amber-400/30 px-1.5 py-0.5 rounded-md">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {b.rating.toFixed(1)}
                      </span>
                    )}
                    {b.publishedYear && (
                      <span className="text-[11px] text-white/40">{b.publishedYear}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
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
                    onClick={() => store.removeSavedBook(b.id)}
                    className="p-2 text-white/40 hover:text-red-400 transition-colors"
                    title="Remove from shelf"
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
