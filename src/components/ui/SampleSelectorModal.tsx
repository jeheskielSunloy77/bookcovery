import React from 'react'
import { X, Camera, Sparkles } from 'lucide-react'

interface SampleSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectSample: (sampleUrl: string) => void
  onSwitchToLiveCamera: () => void
}

const SAMPLES = [
  {
    id: 'shelf-1',
    title: 'Curated Bookshelf',
    description: 'Multiple vertical book spines side by side',
    src: '/samples/shelf-1.jpg',
  },
  {
    id: 'library-shelf',
    title: 'Library Fiction Stacks',
    description: 'Row of library fiction and literature books',
    src: '/samples/library-shelf.jpg',
  },
  {
    id: 'book-cover',
    title: 'Single Book Cover',
    description: 'In-focus front cover inspection',
    src: '/samples/book-cover.jpg',
  },
]

export const SampleSelectorModal: React.FC<SampleSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectSample,
  onSwitchToLiveCamera,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-[#0e131d] border border-white/15 rounded-3xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Choose Scanning Source</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-3">
          {/* Option: Live WebRTC Camera */}
          <button
            onClick={() => {
              onSwitchToLiveCamera()
              onClose()
            }}
            className="w-full p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-4 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                Live Video Camera
              </h4>
              <p className="text-xs text-white/50">
                Use your device's physical camera or webcam
              </p>
            </div>
          </button>

          <div className="text-[11px] font-mono uppercase tracking-wider text-white/40 pt-2 pb-1">
            Or test with sample scenes:
          </div>

          {/* Sample Photos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SAMPLES.map((sample) => (
              <button
                key={sample.id}
                onClick={() => {
                  onSelectSample(sample.src)
                  onClose()
                }}
                className="group flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-amber-400/50 hover:bg-white/10 transition-all text-left"
              >
                <div className="h-24 w-full bg-neutral-900 overflow-hidden relative">
                  <img
                    src={sample.src}
                    alt={sample.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>
                <div className="p-2.5">
                  <h5 className="text-xs font-semibold text-white truncate">{sample.title}</h5>
                  <p className="text-[10px] text-white/50 line-clamp-1 mt-0.5">
                    {sample.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
