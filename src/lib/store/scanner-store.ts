import { useState, useEffect, useCallback } from 'react'
import type { BookMetadata, DetectedBook, HistoryBookRecord, WantedBookItem } from '../books/types'
import { findMatchingWanted, isBookMatchingWanted } from '../books/matcher'

const HISTORY_STORAGE_KEY = 'bookcovery_history_v1'
const LEGACY_STORAGE_KEY = 'bookcovery_saved_books_v1'
const WANTED_STORAGE_KEY = 'bookcovery_wanted_v1'

function isSameBook(
  a: { title: string; author?: string; isbn?: string },
  b: { title: string; author?: string; isbn?: string }
): boolean {
  if (a.isbn && b.isbn && a.isbn.trim() && b.isbn.trim()) {
    const cleanA = a.isbn.replace(/[-\s]/g, '')
    const cleanB = b.isbn.replace(/[-\s]/g, '')
    if (cleanA === cleanB) return true
  }
  const cleanTitleA = a.title.trim().toLowerCase()
  const cleanTitleB = b.title.trim().toLowerCase()
  if (cleanTitleA !== cleanTitleB) return false

  const authorA = (a.author || '').trim().toLowerCase()
  const authorB = (b.author || '').trim().toLowerCase()
  if (!authorA || !authorB) return true
  return authorA === authorB
}

function toBookMetadata(item: DetectedBook | BookMetadata): BookMetadata {
  if ('box2d' in item) {
    if (item.metadata) return item.metadata
    return {
      id: item.id,
      title: item.title,
      author: item.author || 'Unknown Author',
      genres: [],
      source: 'ai-estimate',
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

  // Hydrate history & wanted list from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
      if (stored) {
        setHistoryBooks(JSON.parse(stored))
      } else {
        // Check legacy storage if history doesn't exist yet
        const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (legacyStored) {
          const legacyBooks: BookMetadata[] = JSON.parse(legacyStored)
          const migrated: HistoryBookRecord[] = legacyBooks.map((b, idx) => ({
            ...b,
            recordedAt: Date.now() - idx * 1000,
            scanCount: 1,
          }))
          setHistoryBooks(migrated)
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(migrated))
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

  // Automatically record detected books into local history
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
          const updated: HistoryBookRecord = {
            ...existing,
            ...meta,
            id: existing.id || meta.id,
            coverUrl: meta.coverUrl || existing.coverUrl,
            rating: meta.rating ?? existing.rating,
            ratingsCount: meta.ratingsCount ?? existing.ratingsCount,
            synopsis: meta.synopsis || existing.synopsis,
            publishedYear: meta.publishedYear || existing.publishedYear,
            pageCount: meta.pageCount || existing.pageCount,
            genres: meta.genres?.length ? meta.genres : existing.genres,
            recordedAt: Date.now(),
            scanCount: (existing.scanCount || 1) + 1,
          }
          // Remove from previous position and place at top
          next.splice(existingIdx, 1)
          next.unshift(updated)
        } else {
          // Prepend new recorded book
          const newRecord: HistoryBookRecord = {
            ...meta,
            recordedAt: Date.now(),
            scanCount: 1,
          }
          next.unshift(newRecord)
        }
      }

      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })

    // Automatically check incoming detected books against wanted list and mark as found
    setWantedBooks((prevWanted) => {
      if (prevWanted.length === 0) return prevWanted
      let changed = false
      const nextWanted = prevWanted.map((wanted) => {
        for (const item of incomingList) {
          const meta = toBookMetadata(item)
          if (meta.title && isBookMatchingWanted(meta, wanted) && !wanted.foundAt) {
            changed = true
            return {
              ...wanted,
              foundAt: Date.now(),
              foundBookId: meta.id,
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
    (book?: BookMetadata | null): boolean => {
      if (!book) return false
      return historyBooks.some((b) => isSameBook(b, book))
    },
    [historyBooks]
  )

  // --- Wanted List Actions ---

  const addWantedBook = useCallback(
    (item: { title: string; author?: string; isbn?: string; notes?: string }): WantedBookItem => {
      const cleanTitle = (item.title || '').trim()
      if (!cleanTitle) {
        throw new Error('Title cannot be empty')
      }

      // Check if already in history
      const matchedInHistory = historyBooks.find((hb) =>
        isBookMatchingWanted(hb, {
          id: '',
          title: cleanTitle,
          author: item.author?.trim(),
          isbn: item.isbn?.trim(),
          addedAt: 0,
        })
      )

      const newItem: WantedBookItem = {
        id: `wanted_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: cleanTitle,
        author: item.author?.trim() || undefined,
        isbn: item.isbn?.trim() || undefined,
        notes: item.notes?.trim() || undefined,
        addedAt: Date.now(),
        foundAt: matchedInHistory ? matchedInHistory.recordedAt : undefined,
        foundBookId: matchedInHistory ? matchedInHistory.id : undefined,
      }

      setWantedBooks((prev) => {
        const existing = prev.find((w) => isBookMatchingWanted(newItem, w))
        if (existing) return prev
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
      items: Array<{ title: string; author?: string; isbn?: string; notes?: string }>
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

          const candidate: WantedBookItem = {
            id: `wanted_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title: cleanTitle,
            author: item.author?.trim() || undefined,
            isbn: item.isbn?.trim() || undefined,
            notes: item.notes?.trim() || undefined,
            addedAt: Date.now(),
          }

          // Check duplicate
          const duplicate = next.some((w) => isBookMatchingWanted(candidate, w))
          if (duplicate) {
            skippedCount++
            continue
          }

          // Check if already in history
          const matchedInHistory = historyBooks.find((hb) => isBookMatchingWanted(hb, candidate))
          if (matchedInHistory) {
            candidate.foundAt = matchedInHistory.recordedAt
            candidate.foundBookId = matchedInHistory.id
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

  const markWantedBookFound = useCallback((wantedId: string, historyBookId: string) => {
    setWantedBooks((prev) => {
      let changed = false
      const next = prev.map((item) => {
        if (item.id === wantedId && !item.foundAt) {
          changed = true
          return {
            ...item,
            foundAt: Date.now(),
            foundBookId: historyBookId,
          }
        }
        return item
      })
      if (changed) {
        try {
          localStorage.setItem(WANTED_STORAGE_KEY, JSON.stringify(next))
        } catch {}
      }
      return next
    })
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
    removeWantedBook,
    clearWantedBooks,
    markWantedBookFound,
    getMatchingWantedItem,
    isBookWanted,
    // Backwards compatibility aliases
    savedBooks: historyBooks,
    removeSavedBook: removeHistoryBook,
    isBookSaved: isBookInHistory,
    toggleSaveBook: (book: BookMetadata) => recordBook(book),
  }
}
