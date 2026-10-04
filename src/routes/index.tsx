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
import type { DetectedBook } from '../lib/books/types'

export const Route = createFileRoute('/')({
  component: ScannerPage,
})

function ScannerPage() {
  const store = useScannerStore()
  const [trackedItems, setTrackedItems] = useState<TrackedBookItem[]>([])
  const [activeScansCount, setActiveScansCount] = useState(0)
  const activeScansCountRef = useRef(0)
  const [justCaptured, setJustCaptured] = useState(false)
  const latestTargetBoxRef = useRef<[number, number, number, number] | null>(null)
  const flashTriggerRef = useRef<(() => void) | null>(null)
  const queuedScanRequestedRef = useRef(false)
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
    async (
      base64Data: string,
      source: 'vision' | 'barcode',
      isbn?: string,
      targetBox?: [number, number, number, number]
    ) => {
      if (activeScansCountRef.current >= 3) {
        queuedScanRequestedRef.current = true
        return
      }

      // Shutter tactile feedback
      setJustCaptured(true)
      setTimeout(() => setJustCaptured(false), 380)

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([25])
      }

      // Create an immediate visual pending bracket right where the book is on camera!
      const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const container = containerRef.current
      const video = videoRef.current

      const cWidth = container?.clientWidth || window.innerWidth
      const cHeight = container?.clientHeight || window.innerHeight
      const vWidth = video?.videoWidth || 1280
      const vHeight = video?.videoHeight || 720

      const effectiveBox = targetBox || latestTargetBoxRef.current || [200, 300, 800, 700]
      const initialTargetBox = mapNormalizedBoxToContainer(effectiveBox, vWidth, vHeight, cWidth, cHeight)

      const pendingItem: TrackedBookItem = {
        id: pendingId,
        book: {
          id: pendingId,
          title: 'Analyzing spine...',
          type: 'spine',
          box2d: effectiveBox,
          confidence: 0.8,
          lastSeenTimestamp: Date.now(),
          isPendingAnalysis: true,
        },
        currentBox: { ...initialTargetBox },
        targetBox: initialTargetBox,
        opacity: 1,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      }

      setTrackedItems((prev) => [...prev, pendingItem])

      activeScansCountRef.current += 1
      setActiveScansCount(activeScansCountRef.current)
      store.setIsAiProcessing(true)
      store.setStatusMessage(
        source === 'barcode' ? 'Reading ISBN barcode...' : 'Analyzing book spine with AI...'
      )

      try {
        const response = await scanFrameFn({
          data: {
            imageBase64: base64Data,
            isbn,
            enrich: false,
          },
        })

        // Remove the temporary pending item from tracked items
        setTrackedItems((prev) => prev.filter((item) => item.id !== pendingId))

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
          let next = [...prev]

          detected.forEach((book) => {
            const targetBox = mapNormalizedBoxToContainer(
              book.box2d,
              vWidth,
              vHeight,
              cWidth,
              cHeight
            )

            // Look for matching existing item by ID or smart title/book match
            const matchIndex = next.findIndex(
              (item) => item.id === book.id || isSameBook(item.book, book)
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

          // Keep tracked items list bounded to the most recent 12 books so screen doesn't clutter
          if (next.length > 12) {
            next = next.slice(next.length - 12)
          }

          return next
        })

        // Asynchronously enrich new, un-enriched books in the background without blocking future scans!
        if (booksToEnrich.length > 0) {
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
                  return next
                })
              })
          })
        }
      } catch (err) {
        console.error('[ScannerPage] Scan error:', err)
        store.setStatusMessage('Recognition failed — retrying')
      } finally {
        activeScansCountRef.current = Math.max(0, activeScansCountRef.current - 1)
        setActiveScansCount(activeScansCountRef.current)
        if (activeScansCountRef.current === 0) {
          store.setIsAiProcessing(false)
        }

        // If another scan was queued while this one was running, execute it now!
        if (queuedScanRequestedRef.current && videoRef.current) {
          queuedScanRequestedRef.current = false
          const nextSnapshot = captureVideoSnapshot(videoRef.current, 1024, 0.75)
          if (nextSnapshot) {
            setTimeout(() => {
              handleScanFrame(nextSnapshot, 'vision', undefined, latestTargetBoxRef.current || undefined)
            }, 80)
          }
        }
      }
    },
    [store]
  )

  // Manual Trigger Scan
  const handleTriggerManualScan = useCallback(() => {
    if (!videoRef.current) return
    flashTriggerRef.current?.()
    const snapshot = captureVideoSnapshot(videoRef.current, 1024, 0.75)
    if (snapshot) {
      handleScanFrame(snapshot, 'vision', undefined, latestTargetBoxRef.current || undefined)
    }
  }, [handleScanFrame])

  // Clear detected AR books
  const handleClearTracked = useCallback(() => {
    setTrackedItems([])
    setProcessingBookIds([])
    store.setProcessingBooksCount(0)
    store.setIsAiProcessing(false)
    store.setStatusMessage('Cleared detected books from screen')
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
        isScanning={activeScansCount >= 3}
        isAutoScan={store.isAutoScan}
        facingMode={facingMode}
        isTorchOn={store.isTorchOn}
        onTorchAvailabilityChange={setIsTorchAvailable}
        containerRef={containerRef}
        videoRef={videoRef}
        onTargetBoxChange={(box) => {
          latestTargetBoxRef.current = box
        }}
        flashTriggerRef={flashTriggerRef}
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
        isScanning={activeScansCount >= 3}
        activeScansCount={activeScansCount}
        justCaptured={justCaptured}
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
