import React from 'react'
import {
  Zap,
  ZapOff,
  SwitchCamera,
  Library,
  Camera,
} from 'lucide-react'
import { useScannerStore } from '../../lib/store/scanner-store'

interface ScannerControlsProps {
  store: ReturnType<typeof useScannerStore>
  onSwitchCamera: () => void
  onToggleTorch: () => void
  isTorchAvailable: boolean
  onTriggerManualScan: () => void
  isScanning: boolean
}

export const ScannerControls: React.FC<ScannerControlsProps> = ({
  store,
  onSwitchCamera,
  onToggleTorch,
  isTorchAvailable,
  onTriggerManualScan,
  isScanning,
}) => {
  const { isTorchOn, setIsHistoryOpen, savedBooks } = store

  return (
    <>
      {/* Top Floating Glass Nav */}
      <header className="absolute top-0 inset-x-0 z-40 p-4 sm:p-6 flex items-center justify-between pointer-events-none">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-lg pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span className="text-sm font-bold text-white tracking-tight">Bookcovery</span>
          <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-semibold border border-amber-400/30">
            AR
          </span>
        </div>

        {/* Right Tools: Torch, Flip Camera, Saved Bookshelf */}
        <div className="flex items-center gap-2 pointer-events-auto">
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

          {/* Saved Bookshelf Drawer Button */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="p-2.5 rounded-2xl bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/10 text-white/80 hover:text-white transition-all shadow-lg active:scale-95 relative"
            title="Open saved bookshelf"
          >
            <Library className="w-4 h-4 text-amber-400" />
            {savedBooks.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                {savedBooks.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Bottom Floating Bar */}
      <footer className="absolute bottom-6 inset-x-0 z-40 px-4 flex flex-col items-center gap-3 pointer-events-none">
        {/* Status Pill */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/75 backdrop-blur-xl border border-white/15 text-xs text-white/90 shadow-2xl shadow-black/80 pointer-events-auto">
          {isScanning ? (
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
          <span className="font-medium">{store.statusMessage}</span>
        </div>

        {/* Shutter / Instant Scan Action Button */}
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            onClick={onTriggerManualScan}
            disabled={isScanning}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-sm flex items-center gap-2 shadow-xl shadow-amber-500/25 active:scale-95 transition-all disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            <span>{isScanning ? 'Analyzing Scene...' : 'Scan Now'}</span>
          </button>
        </div>
      </footer>
    </>
  )
}
