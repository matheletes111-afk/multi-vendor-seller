"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog"
import { Button } from "@/ui/button"
import { RotateCw, ZoomIn, ZoomOut, Check, X, Crop, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

export type CropAspectRatio = "free" | "1:1" | "4:3" | "16:9" | "3:2" | "16:10"

interface ImageCropperModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageFile: File | null
  onCropComplete: (croppedFile: File) => void
  aspectRatio?: CropAspectRatio
  title?: string
}

export function ImageCropperModal({
  open,
  onOpenChange,
  imageFile,
  onCropComplete,
  aspectRatio: initialAspectRatio = "free",
  title = "Crop & Adjust Image",
}: ImageCropperModalProps) {
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [aspectRatio, setAspectRatio] = useState<CropAspectRatio>(initialAspectRatio)
  const [saving, setSaving] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Load image when file changes
  useEffect(() => {
    if (!imageFile || !open) {
      setImgElement(null)
      return
    }

    const objectUrl = URL.createObjectURL(imageFile)
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      setImgElement(img)
      setZoom(1)
      setRotation(0)
      setPan({ x: 0, y: 0 })
    }
    img.src = objectUrl

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [imageFile, open])

  // Get crop box dimensions based on container and aspect ratio
  const getCropDimensions = useCallback((containerWidth: number, containerHeight: number) => {
    const padding = 32
    const maxW = Math.max(containerWidth - padding * 2, 100)
    const maxH = Math.max(containerHeight - padding * 2, 100)

    let targetRatio = 1
    if (aspectRatio === "1:1") targetRatio = 1
    else if (aspectRatio === "4:3") targetRatio = 4 / 3
    else if (aspectRatio === "16:9") targetRatio = 16 / 9
    else if (aspectRatio === "3:2") targetRatio = 3 / 2
    else if (aspectRatio === "16:10") targetRatio = 16 / 10
    else {
      // free: use 4:3 default window
      targetRatio = 4 / 3
    }

    let cropW = maxW
    let cropH = cropW / targetRatio

    if (cropH > maxH) {
      cropH = maxH
      cropW = cropH * targetRatio
    }

    return {
      width: Math.round(cropW),
      height: Math.round(cropH),
    }
  }, [aspectRatio])

  // Draw the preview onto canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !imgElement) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const containerWidth = container.clientWidth || 400
    const containerHeight = container.clientHeight || 300

    canvas.width = containerWidth
    canvas.height = containerHeight

    // Clear
    ctx.clearRect(0, 0, containerWidth, containerHeight)

    const cropDim = getCropDimensions(containerWidth, containerHeight)
    const cropX = (containerWidth - cropDim.width) / 2
    const cropY = (containerHeight - cropDim.height) / 2

    ctx.save()

    // Translate to center of crop box
    const centerX = cropX + cropDim.width / 2
    const centerY = cropY + cropDim.height / 2

    ctx.translate(centerX + pan.x, centerY + pan.y)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(zoom, zoom)

    // Calculate base draw dimensions to fit image within crop box
    const isRotated90or270 = rotation === 90 || rotation === 270
    const srcW = isRotated90or270 ? imgElement.naturalHeight : imgElement.naturalWidth
    const srcH = isRotated90or270 ? imgElement.naturalWidth : imgElement.naturalHeight

    const fitScale = Math.max(cropDim.width / srcW, cropDim.height / srcH)
    const drawW = imgElement.naturalWidth * fitScale
    const drawH = imgElement.naturalHeight * fitScale

    ctx.drawImage(imgElement, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()

    // Draw dark overlay outside crop box
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)"
    ctx.beginPath()
    // outer rectangle
    ctx.rect(0, 0, containerWidth, containerHeight)
    // inner rectangle (crop box) counter-clockwise for cutout
    ctx.rect(cropX + cropDim.width, cropY, -cropDim.width, cropDim.height)
    ctx.fill()

    // Draw crop box border
    ctx.strokeStyle = "#3b82f6"
    ctx.lineWidth = 2
    ctx.strokeRect(cropX, cropY, cropDim.width, cropDim.height)

    // Draw grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
    ctx.lineWidth = 1
    // Vertical grid
    ctx.beginPath()
    ctx.moveTo(cropX + cropDim.width / 3, cropY)
    ctx.lineTo(cropX + cropDim.width / 3, cropY + cropDim.height)
    ctx.moveTo(cropX + (cropDim.width * 2) / 3, cropY)
    ctx.lineTo(cropX + (cropDim.width * 2) / 3, cropY + cropDim.height)
    // Horizontal grid
    ctx.moveTo(cropX, cropY + cropDim.height / 3)
    ctx.lineTo(cropX + cropDim.width, cropY + cropDim.height / 3)
    ctx.moveTo(cropX, cropY + (cropDim.height * 2) / 3)
    ctx.lineTo(cropX + cropDim.width, cropY + (cropDim.height * 2) / 3)
    ctx.stroke()

    // Draw corner accents
    const cornerSize = 16
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 3
    // Top-left
    ctx.beginPath()
    ctx.moveTo(cropX, cropY + cornerSize)
    ctx.lineTo(cropX, cropY)
    ctx.lineTo(cropX + cornerSize, cropY)
    // Top-right
    ctx.moveTo(cropX + cropDim.width - cornerSize, cropY)
    ctx.lineTo(cropX + cropDim.width, cropY)
    ctx.lineTo(cropX + cropDim.width, cropY + cornerSize)
    // Bottom-left
    ctx.beginPath()
    ctx.moveTo(cropX, cropY + cropDim.height - cornerSize)
    ctx.lineTo(cropX, cropY + cropDim.height)
    ctx.lineTo(cropX + cornerSize, cropY + cropDim.height)
    // Bottom-right
    ctx.moveTo(cropX + cropDim.width - cornerSize, cropY + cropDim.height)
    ctx.lineTo(cropX + cropDim.width, cropY + cropDim.height)
    ctx.lineTo(cropX + cropDim.width, cropY + cropDim.height - cornerSize)
    ctx.stroke()
  }, [imgElement, zoom, rotation, pan, aspectRatio, getCropDimensions])

  // Mouse / Touch handlers for panning
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((prev) => Math.min(Math.max(prev + delta, 0.8), 4))
  }

  // Rotate 90 deg clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  // Reset adjustments
  const handleReset = () => {
    setZoom(1)
    setRotation(0)
    setPan({ x: 0, y: 0 })
  }

  // Perform final crop export
  const handleSaveCrop = async () => {
    if (!imgElement || !imageFile) return
    setSaving(true)

    try {
      const container = containerRef.current
      if (!container) return

      const containerWidth = container.clientWidth || 400
      const containerHeight = container.clientHeight || 300
      const cropDim = getCropDimensions(containerWidth, containerHeight)

      // Create high-res export canvas
      const exportCanvas = document.createElement("canvas")
      const exportScale = 2 // 2x for sharp resolution
      exportCanvas.width = cropDim.width * exportScale
      exportCanvas.height = cropDim.height * exportScale

      const ctx = exportCanvas.getContext("2d")
      if (!ctx) return

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"

      // Scale to export canvas resolution
      ctx.scale(exportScale, exportScale)

      // Translate to center of export canvas
      ctx.translate(cropDim.width / 2 + pan.x, cropDim.height / 2 + pan.y)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.scale(zoom, zoom)

      const isRotated90or270 = rotation === 90 || rotation === 270
      const srcW = isRotated90or270 ? imgElement.naturalHeight : imgElement.naturalWidth
      const srcH = isRotated90or270 ? imgElement.naturalWidth : imgElement.naturalHeight

      const fitScale = Math.max(cropDim.width / srcW, cropDim.height / srcH)
      const drawW = imgElement.naturalWidth * fitScale
      const drawH = imgElement.naturalHeight * fitScale

      ctx.drawImage(imgElement, -drawW / 2, -drawH / 2, drawW, drawH)

      // Export to Blob
      exportCanvas.toBlob(
        (blob) => {
          if (!blob) {
            setSaving(false)
            return
          }

          const fileName = imageFile.name.replace(/\.[^/.]+$/, "") + "-cropped.jpg"
          const croppedFile = new File([blob], fileName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          })

          onCropComplete(croppedFile)
          onOpenChange(false)
          setSaving(false)
        },
        "image/jpeg",
        0.92
      )
    } catch (err) {
      console.error("Failed to export crop:", err)
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[95vw] p-4 sm:p-6 overflow-hidden rounded-2xl flex flex-col max-h-[92vh]">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Crop className="w-5 h-5 text-blue-600" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Canvas viewport */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative w-full h-[320px] sm:h-[380px] bg-slate-950 rounded-xl overflow-hidden cursor-move select-none touch-none mt-2 flex items-center justify-center"
        >
          <canvas ref={canvasRef} className="w-full h-full block" />
          <div className="absolute bottom-2 left-2 pointer-events-none bg-black/60 text-white/90 text-[10px] px-2 py-1 rounded backdrop-blur-xs">
            Drag to pan • Pinch or scroll to zoom
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3 pt-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min="0.8"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-mono text-muted-foreground w-12 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Action buttons & Aspect Ratio */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t">
            {/* Aspect ratio presets */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground mr-1">Ratio:</span>
              {(["free", "1:1", "4:3", "16:9"] as CropAspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-md transition-colors",
                    aspectRatio === ratio
                      ? "bg-blue-600 text-white font-semibold"
                      : "bg-muted text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-800"
                  )}
                >
                  {ratio === "free" ? "Free" : ratio}
                </button>
              ))}
            </div>

            {/* Rotate & Reset */}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRotate}
                className="h-8 px-2.5 text-xs flex items-center gap-1"
                title="Rotate 90 degrees"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Rotate 90°</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-8 px-2 text-xs text-muted-foreground"
                title="Reset adjustments"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 pt-4 border-t mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSaveCrop}
            disabled={saving || !imgElement}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
          >
            <Check className="w-4 h-4" />
            {saving ? "Applying..." : "Apply Crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
