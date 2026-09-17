"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  Download,
  Camera,
  Crop,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog"
import { validateOnboardingFile, ALLOWED_DOC_ACCEPT, isPdfUrl, isImageUrl } from "@/lib/onboarding-file-validation"
import { ImageCropperModal, CropAspectRatio } from "@/components/media/image-cropper-modal"
import { CameraCaptureModal, CameraGuideType } from "@/components/media/camera-capture-modal"

interface DocUploadPreviewProps {
  label: string
  description?: string
  required?: boolean
  accept?: string
  maxSizeMb?: number
  value?: string | null // Pre-existing URL
  onChange: (file: File | null, previewUrl?: string | null) => void
  disabled?: boolean
  className?: string
  cameraFacingMode?: "user" | "environment"
  cameraGuideType?: CameraGuideType
  cropAspectRatio?: CropAspectRatio
}

export function DocUploadPreview({
  label,
  description,
  required = false,
  accept = ALLOWED_DOC_ACCEPT,
  maxSizeMb = 2.5,
  value = null,
  onChange,
  disabled = false,
  className,
  cameraFacingMode = "environment",
  cameraGuideType = "card",
  cropAspectRatio = "free",
}: DocUploadPreviewProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null)
  const [mimeType, setMimeType] = useState<string | null>(() => {
    if (value) {
      if (isPdfUrl(value)) return "application/pdf"
      return "image/jpeg"
    }
    return null
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const [cropperModalOpen, setCropperModalOpen] = useState(false)
  const [fileToCrop, setFileToCrop] = useState<File | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const revokeBlobUrl = (url: string | null) => {
    if (url && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url)
      } catch (_) {}
    }
  }

  // Sync external value
  useEffect(() => {
    if (value && !selectedFile) {
      setPreviewUrl(value)
      if (isPdfUrl(value)) {
        setMimeType("application/pdf")
      } else {
        setMimeType("image/jpeg")
      }
    }
  }, [value, selectedFile])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      revokeBlobUrl(previewUrl)
    }
  }, [previewUrl])

  const handleFile = async (file: File | null) => {
    setError(null)
    if (!file) return

    const isImageOnly = accept.toLowerCase().includes("image") && !accept.toLowerCase().includes("pdf")
    const validation = validateOnboardingFile(file, { imagesOnly: isImageOnly, maxSizeMb, isPreCompression: true })
    if (!validation.isValid) {
      setError(validation.error || "Invalid file format. Only PDF and image files are allowed.")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    let processedFile = file
    const isImageFile =
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|heic|heif|avif|bmp|tiff?)$/i.test(file.name)

    if (isImageFile) {
      setIsCompressing(true)
      try {
        const { compressImage } = await import("@/lib/image-compressor")
        processedFile = await compressImage(file, 1200, 1200, 0.8)
      } catch (err) {
        console.error("Image compression error:", err)
      } finally {
        setIsCompressing(false)
      }
    }

    if (processedFile.size > maxSizeMb * 1024 * 1024) {
      setError(`File size exceeds ${maxSizeMb}MB limit. Please upload a smaller document.`)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    const type =
      processedFile.type ||
      (processedFile.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg")
    setMimeType(type)
    setSelectedFile(processedFile)

    revokeBlobUrl(previewUrl)
    const objectUrl = URL.createObjectURL(processedFile)
    setPreviewUrl(objectUrl)
    onChange(processedFile, objectUrl)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    revokeBlobUrl(previewUrl)
    setSelectedFile(null)
    setPreviewUrl(null)
    setMimeType(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    onChange(null, null)
  }

  const isPdf = mimeType?.includes("pdf") || isPdfUrl(previewUrl)
  const isImage = mimeType?.startsWith("image/") || isImageUrl(previewUrl)

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
        {previewUrl && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Uploaded
          </Badge>
        )}
      </div>

      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        disabled={disabled || isCompressing}
        onChange={(e) => {
          const f = e.target.files?.[0] || null
          handleFile(f)
        }}
        className="hidden"
      />

      {isCompressing && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-900/50">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
          <span>Optimizing and compressing image...</span>
        </div>
      )}

      {/* Upload Box / Preview Card */}
      {!previewUrl ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled && !isCompressing) setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            if (!disabled && !isCompressing && e.dataTransfer.files?.[0]) {
              handleFile(e.dataTransfer.files[0])
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl transition-all select-none text-center",
            isDragging
              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30"
              : "border-border hover:border-blue-400 bg-card hover:bg-muted/30",
            (disabled || isCompressing) && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div className="p-2 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs font-semibold text-foreground">
            Upload from device or take a photo
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
            PDF or Image files (JPG, PNG, WebP, HEIC - Max {maxSizeMb}MB)
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isCompressing}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 text-xs rounded-lg flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
              Browse Files
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isCompressing}
              onClick={() => setCameraModalOpen(true)}
              className="h-8 px-3 text-xs rounded-lg flex items-center gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950/20"
            >
              <Camera className="w-3.5 h-3.5 text-purple-600" />
              Take Photo
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 border rounded-xl bg-card border-border/80 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border",
                isPdf
                  ? "bg-red-50 text-red-600 border-red-200"
                  : isImage
                  ? "bg-blue-50 text-blue-600 border-blue-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              )}
            >
              {isPdf ? (
                <FileText className="w-5 h-5" />
              ) : isImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUrl}
                  alt={label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FileText className="w-5 h-5 text-slate-500" />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground truncate max-w-[180px] sm:max-w-[260px]">
                {selectedFile?.name || `${label} Document`}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>{isPdf ? "PDF Document" : "Image"}</span>
                {selectedFile?.size && (
                  <span>• {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            {isImage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedFile) {
                    setFileToCrop(selectedFile)
                    setCropperModalOpen(true)
                  } else if (previewUrl) {
                    fetch(previewUrl)
                      .then((res) => res.blob())
                      .then((blob) => {
                        const file = new File([blob], `${label}.jpg`, {
                          type: blob.type || "image/jpeg",
                        })
                        setFileToCrop(file)
                        setCropperModalOpen(true)
                      })
                      .catch(() => setModalOpen(true))
                  }
                }}
                className="h-8 px-2 text-xs rounded-lg flex items-center gap-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                title="Crop or Rotate"
              >
                <Crop className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Crop</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(true)}
              className="h-8 px-2.5 text-xs rounded-lg flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </Button>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        open={cameraModalOpen}
        onOpenChange={setCameraModalOpen}
        onPhotoCaptured={(file) => {
          handleFile(file)
        }}
        facingMode={cameraFacingMode}
        guideType={cameraGuideType}
        title={`Take Photo - ${label}`}
      />

      {/* Image Cropper Modal */}
      <ImageCropperModal
        open={cropperModalOpen}
        onOpenChange={setCropperModalOpen}
        imageFile={fileToCrop}
        aspectRatio={cropAspectRatio}
        onCropComplete={(cropped) => {
          handleFile(cropped)
        }}
        title={`Crop & Adjust - ${label}`}
      />

      {/* Preview Dialog Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[88vh] flex flex-col p-4 sm:p-6 overflow-hidden rounded-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b pr-8">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {isPdf ? (
                <FileText className="w-5 h-5 text-red-600" />
              ) : (
                <ImageIcon className="w-5 h-5 text-blue-600" />
              )}
              {label} Preview
            </DialogTitle>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={selectedFile?.name || `${label}.pdf`}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mr-6"
              >
                <Download className="w-3.5 h-3.5" />
                Open Original
              </a>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto flex items-center justify-center p-2 min-h-[300px] max-h-[65vh]">
            {previewUrl &&
              (isPdf ? (
                <iframe
                  src={`${previewUrl}#toolbar=0`}
                  title={label}
                  className="w-full h-[60vh] rounded-xl border"
                />
              ) : isImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUrl}
                  alt={label}
                  className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-sm"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mb-2 text-slate-400" />
                  <p className="text-sm">Document preview is not available for this format.</p>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
