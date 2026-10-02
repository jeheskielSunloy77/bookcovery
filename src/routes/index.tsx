import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Viewfinder } from '../components/camera/Viewfinder'
import { AROverlay } from '../components/ar/AROverlay'
import { ScannerControls } from '../components/ui/ScannerControls'
import { BookDetailSheet } from '../components/ui/BookDetailSheet'
import { HistoryDrawer } from '../components/ui/HistoryDrawer'
import { useScannerStore, isSameBook } from '../lib/store/scanner-store'
import {
  mapNormalizedBoxToContainer,
  updateTrackedItems,
  type TrackedBookItem,
} from '../lib/vision/tracker'
import { scanFrameFn, enrichBookMetadataFn } from '../lib/server/scan'
import { captureVideoSnapshot } from '../lib/vision/frame-stability'

export const Route = createFileRoute('/')({
  component: ScannerPage,
})

function ScannerPage() {
  const store = useScannerStore()
  const [trackedItems, setTrackedItems] = useState<TrackedBookItem[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [processingBookIds, setProcessingBookIds] = useState<string[]>([])

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [isTorchAvailable, setIsTorchAvailable] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // 60 FPS Tracking & Lerp Update Loop
  useEffect(() => {
    const loop = () => {
      setTrackedItems((prev) => {
        if (prev.length === 0) return prev
        return updateTrackedItems(prev, 0.3, 7000)
      })
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [])

  // Scan handler called by stability analyzer, barcode detector, or manual shutter
  const handleScanFrame = useCallback(
    async (base64Data: string, source: 'vision' | 'barcode', isbn?: string) => {
      if (isScanning || processingBookIds.length > 0) return

      try {
        setIsScanning(true)
        store.setIsAiProcessing(true)
        store.setStatusMessage(
          source === 'barcode' ? 'Reading ISBN barcode...' : 'Identifying books with AI...'
        )

        const response = await scanFrameFn({
          data: {
            imageBase64: base64Data,
            isbn,
            enrich: false,
          },
        })

        if (response.error) {
          store.setStatusMessage(`Scan notice: ${response.error}`)
          return
        }

        const rawDetected = response.books || []
        if (rawDetected.length === 0) {
          store.setStatusMessage('No books detected — adjust camera or tap Scan')
          return
        }

        // Hydrate detected books immediately from local history if they were already enriched
        const booksToEnrich: DetectedBook[] = []
        const detected: DetectedBook[] = rawDetected.map((book) => {
          const cached = store.historyBooks.find(
            (h) =>
              isSameBook(h, book) &&
              (h.coverUrl || h.rating || h.synopsis || h.source === 'google-books' || h.source === 'open-library')
          )

          if (cached) {
            return {
              ...book,
              metadata: {
                ...cached,
                id: book.id,
              },
            }
          }

          booksToEnrich.push(book)
          return book
        })

        // Check if any detected book matches wanted books!
        const wantedMatches = detected.filter((b) => store.isBookWanted(b))

        // Haptic feedback: custom double-buzz for wanted matches, single light buzz for discovery
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          if (wantedMatches.length > 0) {
            navigator.vibrate?.([60, 80, 60])
          } else {
            navigator.vibrate?.([20])
          }
        }

        // Persist recognized books locally into history
        store.recordBooks(detected)

        if (wantedMatches.length > 0) {
          store.setStatusMessage(
            `🎯 Wanted book spotted: "${wantedMatches[0].title}"!`
          )
        } else {
          store.setStatusMessage(
            detected.length === 1
              ? `Identified: "${detected[0].title}"`
              : `Locked onto ${detected.length} books on shelf`
          )
        }

        // Compute screen coordinates for new items
        const container = containerRef.current
        const video = videoRef.current

        const cWidth = container?.clientWidth || window.innerWidth
        const cHeight = container?.clientHeight || window.innerHeight
        const vWidth = video?.videoWidth || 1280
        const vHeight = video?.videoHeight || 720

        const now = Date.now()

        setTrackedItems((prev) => {
          const next = [...prev]

          detected.forEach((book) => {
            const targetBox = mapNormalizedBoxToContainer(
              book.box2d,
              vWidth,
              vHeight,
              cWidth,
              cHeight
            )

            // Look for matching existing item by ID, smart title/book match, or close proximity
            const matchIndex = next.findIndex(
              (item) =>
                item.id === book.id ||
                isSameBook(item.book, book) ||
                Math.abs(item.currentBox.centerX - targetBox.centerX) < 50
            )

            if (matchIndex >= 0) {
              // Update target position and metadata
              next[matchIndex] = {
                ...next[matchIndex],
                book: { ...next[matchIndex].book, metadata: book.metadata || next[matchIndex].book.metadata },
                targetBox,
                lastUpdated: now,
                opacity: 1,
              }
            } else {
              // Add new tracked item
              next.push({
                id: book.id,
                book,
                currentBox: { ...targetBox },
                targetBox,
                opacity: 1,
                createdAt: now,
                lastUpdated: now,
              })
            }
          })

          return next
        })

        // If all detected books are already enriched from local history, skip network lookups!
        if (booksToEnrich.length === 0) {
          store.setIsAiProcessing(false)
          return
        }

        // Asynchronously enrich new, un-enriched books only
        const newIds = booksToEnrich.map((b) => b.id)
        setProcessingBookIds((prev) => Array.from(new Set([...prev, ...newIds])))
        store.setProcessingBooksCount((prev) => prev + newIds.length)

        booksToEnrich.forEach((book) => {
          enrichBookMetadataFn({
            data: {
              bookId: book.id,
              title: book.title,
              author: book.author,
              isbn: book.metadata?.isbn,
            },
          })
            .then((res) => {
              if (res?.metadata) {
                // Update tracked item in AR overlay
                setTrackedItems((prev) =>
                  prev.map((item) =>
                    item.id === res.bookId
                      ? {
                          ...item,
                          book: { ...item.book, metadata: res.metadata },
                        }
                      : item
                  )
                )

                // Update selected book if this book is currently inspected in detail sheet
                store.setSelectedBook((prev) =>
                  prev?.id === res.bookId ? { ...prev, metadata: res.metadata } : prev
                )

                // Update history record with full metadata
                store.recordBooks([{ ...book, metadata: res.metadata }])
              }
            })
            .catch((err) => {
              console.error('[ScannerPage] Enrichment failed for:', book.title, err)
            })
            .finally(() => {
              setProcessingBookIds((prev) => {
                const next = prev.filter((id) => id !== book.id)
                store.setProcessingBooksCount(next.length)
                if (next.length === 0) {
                  store.setIsAiProcessing(false)
                }
                return next
              })
            })
        })
      } catch (err) {
        console.error('[ScannerPage] Scan error:', err)
        store.setStatusMessage('Recognition failed — retrying')
      } finally {
        setIsScanning(false)
      }
    },
    [isScanning, processingBookIds.length, store]
  )

  // Manual Trigger Scan
  const handleTriggerManualScan = useCallback(() => {
    if (isScanning || processingBookIds.length > 0 || !videoRef.current) return
    const snapshot = captureVideoSnapshot(videoRef.current, 1024, 0.75)
    if (snapshot) {
      handleScanFrame(snapshot, 'vision')
    }
  }, [isScanning, processingBookIds.length, handleScanFrame])

  // Clear detected AR books
  const handleClearTracked = useCallback(() => {
    setTrackedItems([])
    setProcessingBookIds([])
    store.setProcessingBooksCount(0)
    store.setIsAiProcessing(false)
    store.setStatusMessage('Cleared detected books')
  }, [store])

  // Camera Switch
  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  // Torch Toggle
  const handleToggleTorch = () => {
    store.setIsTorchOn(!store.isTorchOn)
  }

  return (
    <main
      suppressHydrationWarning
      className="fixed inset-0 w-full h-full h-[100dvh] max-h-[100dvh] overflow-hidden bg-black flex flex-col items-center justify-center select-none"
    >
      {/* 30 FPS Camera & Video Viewfinder */}
      <Viewfinder
        onScanFrame={handleScanFrame}
        isScanning={isScanning || processingBookIds.length > 0}
        isAutoScan={store.isAutoScan}
        facingMode={facingMode}
        isTorchOn={store.isTorchOn}
        onTorchAvailabilityChange={setIsTorchAvailable}
        containerRef={containerRef}
        videoRef={videoRef}
      />

      {/* 60 FPS Real-time AR Overlay */}
      <AROverlay
        items={trackedItems}
        selectedBook={store.selectedBook}
        onSelectBook={(book) => store.setSelectedBook(book)}
        isBookWanted={(book) => store.isBookWanted(book)}
      />

      {/* Tactical Glass HUD Controls */}
      <ScannerControls
        store={store}
        onSwitchCamera={handleSwitchCamera}
        onToggleTorch={handleToggleTorch}
        isTorchAvailable={isTorchAvailable}
        onTriggerManualScan={handleTriggerManualScan}
        isScanning={isScanning}
        processingCount={processingBookIds.length}
        hasTrackedBooks={trackedItems.length > 0}
        onClearTracked={handleClearTracked}
      />

      {/* Book Inspection Bottom Sheet */}
      <BookDetailSheet
        book={store.selectedBook}
        onClose={() => store.setSelectedBook(null)}
        store={store}
      />

      {/* Scan History Drawer */}
      <HistoryDrawer
        isOpen={store.isHistoryOpen}
        onClose={() => store.setIsHistoryOpen(false)}
        store={store}
      />
    </main>
  )
}
