import { useState, useEffect, useCallback } from 'react'
import type { BookMetadata, DetectedBook } from '../books/types'

const STORAGE_KEY = 'bookcovery_saved_books_v1'

export interface ScannerState {
  selectedBook: DetectedBook | null
  savedBooks: BookMetadata[]
  isTorchOn: boolean
  isHistoryOpen: boolean
  isAutoScan: boolean
  statusMessage: string
  isAiProcessing: boolean
  lastScanTime: number | null
}

export function useScannerStore() {
  const [selectedBook, setSelectedBook] = useState<DetectedBook | null>(null)
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isAutoScan, setIsAutoScan] = useState(true)
  const [statusMessage, setStatusMessage] = useState('Aim camera at books to scan')
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [lastScanTime, setLastScanTime] = useState<number | null>(null)
  const [savedBooks, setSavedBooks] = useState<BookMetadata[]>([])

  // Hydrate saved books from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setSavedBooks(JSON.parse(stored))
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  const toggleSaveBook = useCallback((book: BookMetadata) => {
    setSavedBooks((prev) => {
      const exists = prev.some(
        (b) =>
          b.title.toLowerCase() === book.title.toLowerCase() &&
          (b.author.toLowerCase() === book.author.toLowerCase() || !b.author || !book.author)
      )
      let next: BookMetadata[]
      if (exists) {
        next = prev.filter(
          (b) =>
            !(
              b.title.toLowerCase() === book.title.toLowerCase() &&
              (b.author.toLowerCase() === book.author.toLowerCase() || !b.author || !book.author)
            )
        )
      } else {
        next = [book, ...prev]
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  const removeSavedBook = useCallback((bookId: string) => {
    setSavedBooks((prev) => {
      const next = prev.filter((b) => b.id !== bookId)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  const isBookSaved = useCallback(
    (book?: BookMetadata | null): boolean => {
      if (!book) return false
      return savedBooks.some(
        (b) =>
          b.title.toLowerCase() === book.title.toLowerCase() &&
          (b.author.toLowerCase() === book.author.toLowerCase() || !b.author || !book.author)
      )
    },
    [savedBooks]
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
    lastScanTime,
    setLastScanTime,
    savedBooks,
    toggleSaveBook,
    removeSavedBook,
    isBookSaved,
  }
}
