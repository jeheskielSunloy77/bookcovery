import React from 'react'
import {
  Zap,
  ZapOff,
  SwitchCamera,
  History,
  Camera,
  Loader2,
  Trash2,
} from 'lucide-react'
import { useScannerStore } from '../../lib/store/scanner-store'

interface ScannerControlsProps {
  store: ReturnType<typeof useScannerStore>
  onSwitchCamera: () => void
  onToggleTorch: () => void
  isTorchAvailable: boolean
  onTriggerManualScan: () => void
  isScanning: boolean
  hasTrackedBooks?: boolean
  onClearTracked?: () => void
}

export const ScannerControls: React.FC<ScannerControlsProps> = ({
  store,
  onSwitchCamera,
  onToggleTorch,
  isTorchAvailable,
  onTriggerManualScan,
  isScanning,
  hasTrackedBooks = false,
  onClearTracked,
}) => {
  const { isTorchOn, setIsHistoryOpen, historyBooks } = store

  return (
    <>
      <header
        suppressHydrationWarning
        style={{
          top: 'max(0.75rem, env(safe-area-inset-top, 0px))',
        }}
        className="absolute inset-x-0 z-40 p-4 sm:p-6 flex items-center justify-between pointer-events-none"
      >
<div/>
        {/* Right Tools: Torch, Flip Camera, Scan History */}
        <div suppressHydrationWarning className="flex items-center gap-2 pointer-events-auto">
          {/* Torch toggle */}
          {isTorchAvailable && (
            <button
              onClick={onToggleTorch}
              className={`p-2.5 rounded-2xl backdrop-blur-xl border transition-all shadow-lg active:scale-95 ${
                isTorchOn
                  ? 'bg-amber-400 border-amber-300 text-black shadow-amber-500/20'
                  : 'bg-black/60 hover:bg-black/80 border-white/10 text-white/80 hover:text-white'
              }`}
              title="Toggle flashlight"
            >
              {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {/* Camera flip */}
          <button
            onClick={onSwitchCamera}
            className="p-2.5 rounded-2xl bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/10 text-white/80 hover:text-white transition-all shadow-lg active:scale-95"
            title="Switch camera"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          {/* Scan History Drawer Button */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="p-2.5 rounded-2xl bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/10 text-white/80 hover:text-white transition-all shadow-lg active:scale-95 relative"
            title="Open scan history"
          >
            <History className="w-4 h-4 text-amber-400" />
            {historyBooks.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                {historyBooks.length > 99 ? '99+' : historyBooks.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Bottom Floating Bar: Tactile Shutter */}
      <footer
        suppressHydrationWarning
        style={{
          bottom: 'max(1.75rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem))',
        }}
        className="absolute inset-x-0 z-40 px-4 flex flex-col items-center gap-3 pointer-events-none"
      >

        {/* Action Controls: Shutter Button & Clear AR */}
        <div suppressHydrationWarning className="pointer-events-auto flex items-center gap-3">
          {/* Shutter / Instant Manual Trigger Scan Button */}
          <button
            onClick={onTriggerManualScan}
            disabled={isScanning}
            title="Scan books manually if missed by auto-scan"
            className="px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-sm flex items-center gap-2 shadow-xl shadow-amber-500/25 active:scale-95 transition-all disabled:opacity-50"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 text-black" />
                <span>Scan Books</span>
              </>
            )}
          </button>

          {/* Clear AR tags button if books are currently shown */}
          {hasTrackedBooks && onClearTracked && (
            <button
              onClick={onClearTracked}
              className="p-3 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/10 text-white/70 hover:text-red-400 transition-all shadow-lg active:scale-95"
              title="Clear detected books"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>
    </>
  )
}
