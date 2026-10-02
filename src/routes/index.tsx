import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Viewfinder } from '../components/camera/Viewfinder'
import { AROverlay } from '../components/ar/AROverlay'
import { ScannerControls } from '../components/ui/ScannerControls'
import { BookDetailSheet } from '../components/ui/BookDetailSheet'
import { HistoryDrawer } from '../components/ui/HistoryDrawer'
import { useScannerStore } from '../lib/store/scanner-store'
import {
  mapNormalizedBoxToContainer,
  updateTrackedItems,
  type TrackedBookItem,
} from '../lib/vision/tracker'
import type { LocalTargetState } from '../lib/vision/local-recognizer'
import { scanFrameFn } from '../lib/server/scan'
import { captureVideoSnapshot } from '../lib/vision/frame-stability'

export const Route = createFileRoute('/')({
  component: ScannerPage,
})

function ScannerPage() {
  const store = useScannerStore()
  const [trackedItems, setTrackedItems] = useState<TrackedBookItem[]>([])
  const [localTarget, setLocalTarget] = useState<LocalTargetState | null>(null)
  const [isScanning, setIsScanning] = useState(false)

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
      if (isScanning) return

      try {
        setIsScanning(true)
        store.setStatusMessage(
          source === 'barcode' ? 'Reading ISBN barcode...' : 'Identifying books with AI...'
        )

        const response = await scanFrameFn({
          data: {
            imageBase64: base64Data,
            isbn,
          },
        })

        if (response.error) {
          store.setStatusMessage(`Scan notice: ${response.error}`)
          return
        }

        const detected = response.books || []
        if (detected.length === 0) {
          store.setStatusMessage('No books detected in frame — adjust camera')
          return
        }

        // Haptic feedback for discovery
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.([20])
        }

        store.setStatusMessage(
          detected.length === 1
            ? `Found: "${detected[0].title}"`
            : `Locked onto ${detected.length} books on shelf`
        )

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

            // Look for matching existing item by title or close proximity
            const matchIndex = next.findIndex(
              (item) =>
                item.book.title.toLowerCase() === book.title.toLowerCase() ||
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
      } catch (err) {
        console.error('[ScannerPage] Scan error:', err)
        store.setStatusMessage('Recognition failed — retrying')
      } finally {
        setIsScanning(false)
      }
    },
    [isScanning, store]
  )

  // Manual Trigger Scan
  const handleTriggerManualScan = useCallback(() => {
    if (isScanning || !videoRef.current) return
    const snapshot = captureVideoSnapshot(videoRef.current, 1024, 0.75)
    if (snapshot) {
      handleScanFrame(snapshot, 'vision')
    }
  }, [isScanning, handleScanFrame])

  // Clear detected AR books
  const handleClearTracked = useCallback(() => {
    setTrackedItems([])
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
      className="relative w-screen h-screen overflow-hidden bg-black flex flex-col items-center justify-center"
    >
      {/* 30 FPS Camera & Video Viewfinder */}
      <Viewfinder
        onScanFrame={handleScanFrame}
        isScanning={isScanning}
        isAutoScan={store.isAutoScan}
        facingMode={facingMode}
        isTorchOn={store.isTorchOn}
        onTorchAvailabilityChange={setIsTorchAvailable}
        onLocalTargetChange={setLocalTarget}
        containerRef={containerRef}
        videoRef={videoRef}
      />

      {/* 60 FPS Real-time AR Overlay */}
      <AROverlay
        items={trackedItems}
        selectedBook={store.selectedBook}
        onSelectBook={(book) => store.setSelectedBook(book)}
        localTarget={localTarget}
        isScanning={isScanning}
        containerWidth={containerRef.current?.clientWidth}
        containerHeight={containerRef.current?.clientHeight}
        videoWidth={videoRef.current?.videoWidth}
        videoHeight={videoRef.current?.videoHeight}
      />

      {/* Tactical Glass HUD Controls */}
      <ScannerControls
        store={store}
        onSwitchCamera={handleSwitchCamera}
        onToggleTorch={handleToggleTorch}
        isTorchAvailable={isTorchAvailable}
        onTriggerManualScan={handleTriggerManualScan}
        isScanning={isScanning}
        hasTrackedBooks={trackedItems.length > 0}
        onClearTracked={handleClearTracked}
      />

      {/* Book Inspection Bottom Sheet */}
      <BookDetailSheet
        book={store.selectedBook}
        onClose={() => store.setSelectedBook(null)}
        store={store}
      />

      {/* Saved Bookshelf Drawer */}
      <HistoryDrawer
        isOpen={store.isHistoryOpen}
        onClose={() => store.setIsHistoryOpen(false)}
        store={store}
      />
    </main>
  )
}
