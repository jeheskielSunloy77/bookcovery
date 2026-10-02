import React, { useState, useMemo } from 'react'
import { X, FileCode, CheckCircle2, AlertCircle, Sparkles, ArrowRight } from 'lucide-react'

interface BatchImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (
    items: Array<{
      title: string
      author?: string
      isbn?: string
      notes?: string
      coverUrl?: string
    }>
  ) => { added: number; skipped: number }
}

const EXAMPLE_JSON = JSON.stringify(
  [
    {
      title: 'Atomic Habits',
      author: 'James Clear',
      notes: 'Hardcover edition preferred',
    },
    {
      title: 'Dune',
      author: 'Frank Herbert',
      isbn: '9780441172719',
    },
    {
      title: 'Project Hail Mary',
      author: 'Andy Weir',
    },
    {
      title: 'Klara and the Sun',
      author: 'Kazuo Ishiguro',
    },
  ],
  null,
  2
)

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [jsonText, setJsonText] = useState('')
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null)

  // Real-time JSON parser & validation
  const validation = useMemo(() => {
    const trimmed = jsonText.trim()
    if (!trimmed) {
      return { valid: false, error: null, items: [] }
    }

    try {
      const parsed = JSON.parse(trimmed)
      const list: Array<{
        title: string
        author?: string
        isbn?: string
        notes?: string
        coverUrl?: string
      }> = []

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string') {
            const clean = item.trim()
            if (clean) list.push({ title: clean })
          } else if (item && typeof item === 'object') {
            const raw = item as Record<string, unknown>
            const title = typeof raw.title === 'string' ? raw.title.trim() : ''
            if (title) {
              const cover =
                typeof raw.coverUrl === 'string'
                  ? raw.coverUrl.trim()
                  : typeof raw.cover === 'string'
                    ? raw.cover.trim()
                    : typeof raw.image === 'string'
                      ? raw.image.trim()
                      : undefined
              list.push({
                title,
                author: typeof raw.author === 'string' ? raw.author.trim() : undefined,
                isbn: typeof raw.isbn === 'string' ? raw.isbn.trim() : undefined,
                notes: typeof raw.notes === 'string' ? raw.notes.trim() : undefined,
                coverUrl: cover,
              })
            }
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        const raw = parsed as Record<string, unknown>
        const title = typeof raw.title === 'string' ? raw.title.trim() : ''
        if (title) {
          const cover =
            typeof raw.coverUrl === 'string'
              ? raw.coverUrl.trim()
              : typeof raw.cover === 'string'
                ? raw.cover.trim()
                : typeof raw.image === 'string'
                  ? raw.image.trim()
                  : undefined
          list.push({
            title,
            author: typeof raw.author === 'string' ? raw.author.trim() : undefined,
            isbn: typeof raw.isbn === 'string' ? raw.isbn.trim() : undefined,
            notes: typeof raw.notes === 'string' ? raw.notes.trim() : undefined,
            coverUrl: cover,
          })
        }
      }

      if (list.length === 0) {
        return {
          valid: false,
          error: 'No valid books with a "title" found in the JSON payload.',
          items: [],
        }
      }

      return { valid: true, error: null, items: list }
    } catch (err) {
      return {
        valid: false,
        error: (err as Error).message || 'Invalid JSON syntax',
        items: [],
      }
    }
  }, [jsonText])

  if (!isOpen) return null

  const handleApplyImport = () => {
    if (!validation.valid || validation.items.length === 0) return

    const result = onImport(validation.items)
    setStatusFeedback(
      `Successfully added ${result.added} ${result.added === 1 ? 'book' : 'books'}${
        result.skipped > 0 ? ` (${result.skipped} duplicate/skipped)` : ''
      }!`
    )

    setTimeout(() => {
      setStatusFeedback(null)
      setJsonText('')
      onClose()
    }, 1200)
  }

  const handleInsertExample = () => {
    setJsonText(EXAMPLE_JSON)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-[#0d121c] border border-white/15 rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Batch Add Books</h3>
              <p className="text-xs text-white/50">Paste a JSON array of books to add to Wanted List</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/70">JSON Payload</span>
            <button
              type="button"
              onClick={handleInsertExample}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Insert Example Template</span>
            </button>
          </div>

          {/* Code Editor Textarea */}
          <div className="relative">
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={`[\n  { "title": "Book Title", "author": "Author Name", "isbn": "Optional ISBN" }\n]`}
              rows={8}
              className="w-full font-mono text-xs bg-black/60 border border-white/10 rounded-2xl p-3.5 text-white/90 placeholder-white/20 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 transition-all resize-y"
            />
          </div>

          {/* Validation Feedback */}
          {validation.error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="break-all">{validation.error}</span>
            </div>
          )}

          {validation.valid && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Found <strong>{validation.items.length}</strong> valid {validation.items.length === 1 ? 'book' : 'books'} ready to import
              </span>
            </div>
          )}

          {statusFeedback && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center gap-2 text-xs text-amber-300 font-medium animate-in fade-in">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{statusFeedback}</span>
            </div>
          )}

          <div className="text-[11px] text-white/40 leading-relaxed">
            Format support: Accepts array of objects with <code className="text-white/70">"title"</code>, <code className="text-white/70">"author"</code>, <code className="text-white/70">"isbn"</code>, or simple string array like <code className="text-white/70">["Title 1", "Title 2"]</code>.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyImport}
            disabled={!validation.valid || validation.items.length === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <span>Import {validation.items.length > 0 ? `${validation.items.length} Books` : 'Books'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
