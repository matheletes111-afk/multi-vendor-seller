"use client"

import { useEffect, useCallback } from "react"
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react"

export interface ReviewImageModalProps {
  isOpen: boolean
  onClose: () => void
  images: string[]
  currentIndex: number
  onIndexChange?: (index: number) => void
}

export function ReviewImageModal({
  isOpen,
  onClose,
  images,
  currentIndex,
  onIndexChange,
}: ReviewImageModalProps) {
  const safeImages = images.filter(Boolean)
  const currentImage = safeImages[currentIndex] || safeImages[0]

  const handlePrev = useCallback(() => {
    if (safeImages.length <= 1) return
    const prevIndex = (currentIndex - 1 + safeImages.length) % safeImages.length
    onIndexChange?.(prevIndex)
  }, [currentIndex, safeImages.length, onIndexChange])

  const handleNext = useCallback(() => {
    if (safeImages.length <= 1) return
    const nextIndex = (currentIndex + 1) % safeImages.length
    onIndexChange?.(nextIndex)
  }, [currentIndex, safeImages.length, onIndexChange])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowLeft") {
        handlePrev()
      } else if (e.key === "ArrowRight") {
        handleNext()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose, handlePrev, handleNext])

  if (!isOpen || !currentImage) return null

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200 p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header Control Bar */}
      <div 
        className="w-full max-w-5xl flex items-center justify-between py-2 text-white/90 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wide bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
          <Maximize2 className="h-4 w-4 text-emerald-400" />
          <span>Image {currentIndex + 1} of {safeImages.length}</span>
        </div>
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all focus:outline-none ring-1 ring-white/20 hover:scale-105 active:scale-95"
          aria-label="Close modal"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Main Image Container */}
      <div
        className="relative max-w-5xl w-full flex-1 flex flex-col items-center justify-center min-h-0 my-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center w-full h-full max-h-[75vh] select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImage}
            alt={`Review image ${currentIndex + 1}`}
            className="max-h-[75vh] max-w-full w-auto h-auto object-contain rounded-2xl shadow-2xl transition-all duration-300 ring-1 ring-white/10"
          />

          {/* Navigation Arrows */}
          {safeImages.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-2 sm:left-4 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all focus:outline-none ring-1 ring-white/20 hover:scale-110 active:scale-95 shadow-xl"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-2 sm:right-4 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all focus:outline-none ring-1 ring-white/20 hover:scale-110 active:scale-95 shadow-xl"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail Strip */}
        {safeImages.length > 1 && (
          <div className="flex items-center gap-2 mt-4 overflow-x-auto max-w-full p-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md scrollbar-none">
            {safeImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => onIndexChange?.(idx)}
                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                  idx === currentIndex
                    ? "border-emerald-500 scale-105 shadow-lg ring-2 ring-emerald-500/50"
                    : "border-transparent opacity-50 hover:opacity-100 hover:scale-102"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
