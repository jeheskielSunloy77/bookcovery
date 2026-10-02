import { useState, useEffect, useCallback } from 'react'
import type { BookMetadata, DetectedBook, HistoryBookRecord, WantedBookItem } from '../books/types'
import {
  findMatchingWanted,
  isBookMatchingWanted,
  cleanIsbn,
  normalizeText,
  getMainTitle,
  isAuthorMatch,
  isTitleMatch,
} from '../books/matcher'

const HISTORY_STORAGE_KEY = 'bookcovery_history_v1'
const LEGACY_STORAGE_KEY = 'bookcovery_saved_books_v1'
const WANTED_STORAGE_KEY = 'bookcovery_wanted_v1'

export function isSameBook(
  a?: { id?: string; title?: string; author?: string; isbn?: string } | null,
  b?: { id?: string; title?: string; author?: string; isbn?: string } | null
): boolean {
  if (!a || !b) return false

  // 1. Same ID
  if (a.id && b.id && a.id === b.id) return true

  // 2. ISBN matching (exact match if both have valid ISBN)
  const isbnA = cleanIsbn(a.isbn)
  const isbnB = cleanIsbn(b.isbn)
  if (isbnA && isbnB && isbnA.length >= 9 && isbnB.length >= 9) {
    if (isbnA === isbnB) return true
  }

  const titleA = a.title ? a.title.trim() : ''
  const titleB = b.title ? b.title.trim() : ''
  if (!titleA || !titleB) return false

  // Check author compatibility: if both have clearly distinct authors, reject match
  if (!isAuthorMatch(a.author, b.author)) return false

  // 3. Exact normalized title match (ignores punctuation, case, diacritics)
  const normA = normalizeText(titleA)
  const normB = normalizeText(titleB)
  if (normA && normB && normA === normB) return true

  // 4. Main title without subtitle (e.g. "Sapiens: A Brief History" vs "Sapiens")
  const mainA = getMainTitle(titleA)
  const mainB = getMainTitle(titleB)
  if (mainA && mainB && mainA.length >= 3 && mainA === mainB) {
    return true
  }

  // 5. Subtitle prefix match
  if (normA.length >= 4 && normB.length >= 4) {
    if (normA.startsWith(normB) || normB.startsWith(normA)) {
      const shorter = normA.length < normB.length ? normA : normB
      const longer = normA.length < normB.length ? normB : normA
      if (longer[shorter.length] === ' ' || longer[shorter.length] === undefined) {
        return true
      }
    }
  }

  // 6. Fuzzy / token overlap title match
  return isTitleMatch(titleA, titleB)
}

export function mergeBookRecords(
  existing: HistoryBookRecord,
  incoming: BookMetadata
): HistoryBookRecord {
  const isIncomingEnriched = incoming.source === 'google-books' || incoming.source === 'open-library'
  const isExistingEnriched = existing.source === 'google-books' || existing.source === 'open-library'

  const title = isIncomingEnriched && incoming.title
    ? incoming.title
    : isExistingEnriched && existing.title
      ? existing.title
      : incoming.title && incoming.title.length > existing.title.length
        ? incoming.title
        : existing.title

  const author = isIncomingEnriched && incoming.author && incoming.author !== 'Unknown Author'
    ? incoming.author
    : isExistingEnriched && existing.author && existing.author !== 'Unknown Author'
      ? existing.author
      : incoming.author && incoming.author !== 'Unknown Author'
        ? incoming.author
        : existing.author

  const existingSources = existing.sources || (existing.source ? [existing.source] : [])
  const incomingSources = incoming.sources || (incoming.source ? [incoming.source] : [])
  const mergedSources = Array.from(new Set([...existingSources, ...incomingSources]))

  return {
    ...existing,
    ...incoming,
    id: existing.id || incoming.id,
    title,
    author,
    coverUrl: incoming.coverUrl || existing.coverUrl,
    rating: incoming.rating ?? existing.rating,
    ratingsCount: incoming.ratingsCount ?? existing.ratingsCount,
    synopsis: incoming.synopsis || existing.synopsis,
    publishedYear: incoming.publishedYear || existing.publishedYear,
    pageCount: incoming.pageCount || existing.pageCount,
    genres: incoming.genres?.length ? incoming.genres : existing.genres,
    isbn: incoming.isbn || existing.isbn,
    source: (isIncomingEnriched ? incoming.source : existing.source) || incoming.source || 'ai-estimate',
    sources: mergedSources.length > 0 ? (mergedSources as ('google-books' | 'open-library' | 'ai-estimate')[]) : undefined,
    ratingsBreakdown: incoming.ratingsBreakdown || existing.ratingsBreakdown,
    recordedAt: Math.max(existing.recordedAt || 0, Date.now()),
  }
}

export function deduplicateHistory(books: HistoryBookRecord[]): HistoryBookRecord[] {
  const result: HistoryBookRecord[] = []
  for (const book of books) {
    const existingIdx = result.findIndex((existing) => isSameBook(existing, book))
    if (existingIdx >= 0) {
      result[existingIdx] = mergeBookRecords(result[existingIdx], book)
    } else {
      const { scanCount, ...cleanBook } = book as any
      result.push(cleanBook)
    }
  }
  return result
}

function toBookMetadata(item: DetectedBook | BookMetadata): BookMetadata {
  if ('box2d' in item) {
    if (item.metadata) {
      return {
        ...item.metadata,
        id: item.id || item.metadata.id,
      }
    }
    return {
      id: item.id,
      title: item.title,
      author: item.author || 'Unknown Author',
      genres: [],
      source: 'ai-estimate',
      sources: ['ai-estimate'],
    }
  }
  return item
}

export interface ScannerState {
  selectedBook: DetectedBook | null
  historyBooks: HistoryBookRecord[]
  wantedBooks: WantedBookItem[]
  isTorchOn: boolean
  isHistoryOpen: boolean
  isAutoScan: boolean
  statusMessage: string
  isAiProcessing: boolean
  processingBooksCount: number
  lastScanTime: number | null
}

export function useScannerStore() {
  const [selectedBook, setSelectedBook] = useState<DetectedBook | null>(null)
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isAutoScan, setIsAutoScan] = useState(true)
  const [statusMessage, setStatusMessage] = useState('')
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [processingBooksCount, setProcessingBooksCount] = useState(0)
  const [lastScanTime, setLastScanTime] = useState<number | null>(null)
  const [historyBooks, setHistoryBooks] = useState<HistoryBookRecord[]>([])
  const [wantedBooks, setWantedBooks] = useState<WantedBookItem[]>([])

  // Hydrate history & wanted list from localStorage (with automatic deduplication pass)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
      if (stored) {
        const parsed: HistoryBookRecord[] = JSON.parse(stored)
        const deduped = deduplicateHistory(parsed)
        setHistoryBooks(deduped)
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(deduped))
      } else {
        // Check legacy storage if history doesn't exist yet
        const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (legacyStored) {
          const legacyBooks: BookMetadata[] = JSON.parse(legacyStored)
          const migrated: HistoryBookRecord[] = legacyBooks.map((b, idx) => ({
            ...b,
            recordedAt: Date.now() - idx * 1000,
          }))
          const deduped = deduplicateHistory(migrated)
          setHistoryBooks(deduped)
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(deduped))
        }
      }

      const storedWanted = localStorage.getItem(WANTED_STORAGE_KEY)
      if (storedWanted) {
        setWantedBooks(JSON.parse(storedWanted))
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  // Automatically record detected books into local history (strictly deduplicated)
  const recordBooks = useCallback((incomingList: (DetectedBook | BookMetadata)[]) => {
    if (!incomingList || incomingList.length === 0) return

    setHistoryBooks((prev) => {
      let next = [...prev]

      for (const item of incomingList) {
        const meta = toBookMetadata(item)
        if (!meta.title || meta.title.trim().length === 0) continue

        const existingIdx = next.findIndex((b) => isSameBook(b, meta))
        if (existingIdx >= 0) {
          const existing = next[existingIdx]
          const updated = mergeBookRecords(existing, meta)
          // Remove from previous position and place at top
          next.splice(existingIdx, 1)
          next.unshift(updated)
        } else {
          // Prepend new recorded book
          const newRecord: HistoryBookRecord = {
            ...meta,
            recordedAt: Date.now(),
          }
          next.unshift(newRecord)
        }
      }

      // Final deduplication pass to ensure single item per book
      next = deduplicateHistory(next)

      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })

    // Auto-populate coverUrl for wanted books if missing and detected by camera
    setWantedBooks((prevWanted) => {
      if (prevWanted.length === 0) return prevWanted
      let changed = false
      const nextWanted = prevWanted.map((wanted) => {
        if (!wanted.coverUrl) {
          for (const item of incomingList) {
            const meta = toBookMetadata(item)
            if (meta.title && isBookMatchingWanted(meta, wanted) && meta.coverUrl) {
              changed = true
              return {
                ...wanted,
                coverUrl: meta.coverUrl,
              }
            }
          }
        }
        return wanted
      })
      if (changed) {
        try {
          localStorage.setItem(WANTED_STORAGE_KEY, JSON.stringify(nextWanted))
        } catch {}
        return nextWanted
      }
      return prevWanted
    })
  }, [])

  const recordBook = useCallback(
    (book: DetectedBook | BookMetadata) => {
      recordBooks([book])
    },
    [recordBooks]
  )

  const removeHistoryBook = useCallback((bookId: string) => {
    setHistoryBooks((prev) => {
      const next = prev.filter((b) => b.id !== bookId)
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistoryBooks([])
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([]))
    } catch {
      // Ignore storage errors
    }
  }, [])

  const isBookInHistory = useCallback(
    (book?: { title?: string; author?: string; isbn?: string; id?: string } | BookMetadata | DetectedBook | null): boolean => {
      if (!book) return false
      const meta = 'box2d' in book ? toBookMetadata(book) : book
      if (!meta.title) return false
      return historyBooks.some((b) => isSameBook(b, meta))
    },
    [historyBooks]
  )

  // --- Wanted List Actions ---

  const addWantedBook = useCallback(
    (item: {
      title: string
      author?: string
      isbn?: string
      notes?: string
      coverUrl?: string
    }): WantedBookItem => {
      const cleanTitle = (item.title || '').trim()
      if (!cleanTitle) {
        throw new Error('Title cannot be empty')
      }

      // Check if already in history to retrieve coverUrl
      const matchedInHistory = historyBooks.find((hb) =>
        isBookMatchingWanted(hb, {
          id: '',
          title: cleanTitle,
          author: item.author?.trim(),
          isbn: item.isbn?.trim(),
          addedAt: 0,
        })
      )

      const coverUrl = item.coverUrl || matchedInHistory?.coverUrl

      const newItem: WantedBookItem = {
        id: `wanted_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: cleanTitle,
        author: item.author?.trim() || undefined,
        isbn: item.isbn?.trim() || undefined,
        coverUrl,
        notes: item.notes?.trim() || undefined,
        addedAt: Date.now(),
      }

      setWantedBooks((prev) => {
        const existing = prev.find((w) => isBookMatchingWanted(newItem, w))
        if (existing) {
          if (!existing.coverUrl && coverUrl) {
            const updated = prev.map((w) => (w.id === existing.id ? { ...w, coverUrl } : w))
            try {
              localStorage.setItem(WANTED_STORAGE_KEY, JSON.stringify(updated))
            } catch {}
            return updated
          }
          return prev
        }
        const next = [newItem, ...prev]
        try {
          localStorage.setItem(WANTED_STORAGE_KEY, JSON.stringify(next))
        } catch {}
        return next
      })

      return newItem
    },
    [historyBooks]
  )

  const batchAddWantedBooks = useCallback(
    (
      items: Array<{
        title: string
        author?: string
        isbn?: string
        notes?: string
        coverUrl?: string
      }>
    ): { added: number; skipped: number } => {
      if (!items || items.length === 0) return { added: 0, skipped: 0 }

      let addedCount = 0
      let skippedCount = 0

      setWantedBooks((prev) => {
        const next = [...prev]

        for (const item of items) {
          const cleanTitle = (item.title || '').trim()
          if (!cleanTitle) {
            skippedCount++
            continue
          }

          // Check if already in history to retrieve coverUrl
          const matchedInHistory = historyBooks.find((hb) =>
            isBookMatchingWanted(hb, {
              id: '',
              title: cleanTitle,
              author: item.author?.trim(),
              isbn: item.isbn?.trim(),
              addedAt: 0,
            })
          )

          const coverUrl = item.coverUrl || matchedInHistory?.coverUrl

          const candidate: WantedBookItem = {
            id: `wanted_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title: cleanTitle,
            author: item.author?.trim() || undefined,
            isbn: item.isbn?.trim() || undefined,
            coverUrl,
            notes: item.notes?.trim() || undefined,
            addedAt: Date.now(),
          }

          // Check duplicate
          const existingIdx = next.findIndex((w) => isBookMatchingWanted(candidate, w))
          if (existingIdx >= 0) {
            if (!next[existingIdx].coverUrl && coverUrl) {
              next[existingIdx] = { ...next[existingIdx], coverUrl }
            }
            skippedCount++
            continue
          }

          next.unshift(candidate)
          addedCount++
        }

        try {
          localStorage.setItem(WANTED_STORAGE_KEY, JSON.stringify(next))
        } catch {}
        return next
      })

      return { added: addedCount, skipped: skippedCount }
    },
    [historyBooks]
  )

  const updateWantedBook = useCallback((id: string, updates: Partial<WantedBookItem>) => {
    setWantedBooks((prev) => {
      let changed = false
      const next = prev.map((item) => {
        if (item.id === id) {
          changed = true
          return { ...item, ...updates }
        }
        return item
      })
      if (changed) {
        try {
          localStorage.setItem(WANTED_STORAGE_KEY, JSON.stringify(next))
        } catch {}
        return next
      }
      return prev
    })
  }, [])

  const removeWantedBook = useCallback((id: string) => {
    setWantedBooks((prev) => {
      const next = prev.filter((w) => w.id !== id)
      try {
        localStorage.setItem(WANTED_STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const clearWantedBooks = useCallback(() => {
    setWantedBooks([])
    try {
      localStorage.setItem(WANTED_STORAGE_KEY, JSON.stringify([]))
    } catch {}
  }, [])

  const getMatchingWantedItem = useCallback(
    (book?: { title: string; author?: string; isbn?: string } | null): WantedBookItem | undefined => {
      if (!book || !book.title) return undefined
      return findMatchingWanted(book, wantedBooks)
    },
    [wantedBooks]
  )

  const isBookWanted = useCallback(
    (book?: { title: string; author?: string; isbn?: string } | null): boolean => {
      return !!getMatchingWantedItem(book)
    },
    [getMatchingWantedItem]
  )

  return {
    selectedBook,
    setSelectedBook,
    isTorchOn,
    setIsTorchOn,
    isHistoryOpen,
    setIsHistoryOpen,
    isAutoScan,
    setIsAutoScan,
    statusMessage,
    setStatusMessage,
    isAiProcessing,
    setIsAiProcessing,
    processingBooksCount,
    setProcessingBooksCount,
    lastScanTime,
    setLastScanTime,
    historyBooks,
    recordBooks,
    recordBook,
    removeHistoryBook,
    clearHistory,
    isBookInHistory,
    // Wanted list state and methods
    wantedBooks,
    addWantedBook,
    batchAddWantedBooks,
    updateWantedBook,
    removeWantedBook,
    clearWantedBooks,
    getMatchingWantedItem,
    isBookWanted,
    // Backwards compatibility aliases
    savedBooks: historyBooks,
    removeSavedBook: removeHistoryBook,
    isBookSaved: isBookInHistory,
    toggleSaveBook: (book: BookMetadata) => recordBook(book),
  }
}
