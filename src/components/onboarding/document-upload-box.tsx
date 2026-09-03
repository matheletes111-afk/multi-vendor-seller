"use client"

import React, { useState, useRef, useEffect } from "react"
import { UploadCloud, FileText, Image as ImageIcon, Camera, Crop, Eye, X, CheckCircle2, AlertCircle, RefreshCw, Download } from "lucide-react"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog"
import { validateOnboardingFile, ALLOWED_DOC_ACCEPT, ALLOWED_IMAGE_ONLY_ACCEPT, isPdfUrl, isImageUrl } from "@/lib/onboarding-file-validation"
import { ImageCropperModal, CropAspectRatio } from "@/components/media/image-cropper-modal"
import { CameraCaptureModal, CameraGuideType } from "@/components/media/camera-capture-modal"

export interface DocumentUploadBoxProps {
  id?: string
  name: string
  label: string
  description?: string
  required?: boolean
  accept?: string
  maxSizeMb?: number
  currentUrl?: string | null
  localFile?: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
  className?: string
  imagesOnly?: boolean
  cropAspectRatio?: CropAspectRatio
  cameraFacingMode?: "user" | "environment"
  cameraGuideType?: CameraGuideType
}

export function DocumentUploadBox({
  id,
  name,
  label,
  description,
  required = false,
  accept = ALLOWED_DOC_ACCEPT,
  maxSizeMb = 4.5,
  currentUrl,
  localFile,
  onChange,
  disabled = false,
  className,
  imagesOnly = false,
  cropAspectRatio = "free",
  cameraFacingMode = "environment",
  cameraGuideType = "card",
}: DocumentUploadBoxProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(localFile || null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Modals state
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const [cropperModalOpen, setCropperModalOpen] = useState(false)
  const [fileToCrop, setFileToCrop] = useState<File | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync with localFile prop if changed from outside
  useEffect(() => {
    if (localFile !== undefined) {
      setSelectedFile(localFile)
      if (localFile) {
        const url = URL.createObjectURL(localFile)
        setPreviewUrl(url)
        return () => URL.revokeObjectURL(url)
      } else {
        setPreviewUrl(null)
      }
    }
  }, [localFile])

  // Active display URL: local preview or DB currentUrl
  const activeUrl = previewUrl || currentUrl || null

  // Determine if active document is PDF or Image
  const isPdf = selectedFile
    ? selectedFile.type === "application/pdf" || selectedFile.name.toLowerCase().endsWith(".pdf")
    : isPdfUrl(activeUrl)

  const isImage = selectedFile
    ? selectedFile.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|bmp|avif)$/i.test(selectedFile.name)
    : isImageUrl(activeUrl)

  // Process and compress file
  const processAndSetFile = async (file: File) => {
    setError(null)

    // Validate
    const validation = validateOnboardingFile(file, { imagesOnly, maxSizeMb })
    if (!validation.isValid) {
      setError(validation.error || "Invalid file format.")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    let processedFile = file

    // Compress image files
    if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
      try {
        const { compressImage } = await import("@/lib/image-compressor")
        processedFile = await compressImage(file, 1200, 1200, 0.8)
      } catch (err) {
        console.error("Compression error:", err)
      }
    }

    if (processedFile.size > maxSizeMb * 1024 * 1024) {
      setError(`File size exceeds ${maxSizeMb} MB limit. Please select a smaller file.`)
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const newUrl = URL.createObjectURL(processedFile)
    setPreviewUrl(newUrl)
    setSelectedFile(processedFile)
    onChange(processedFile)
  }

  // Handle system file selection
  const handleSystemFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // If it's an image, we can optionally open the cropper right away or set it directly
    if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
      setFileToCrop(file)
      setCropperModalOpen(true)
    } else {
      // PDF or other allowed file
      processAndSetFile(file)
    }
  }

  // Handle photo captured from camera modal
  const handleCameraPhoto = (file: File) => {
    setFileToCrop(file)
    setCropperModalOpen(true)
  }

  // Handle crop completion
  const handleCropComplete = (croppedFile: File) => {
    processAndSetFile(croppedFile)
  }

  // Remove file
  const handleRemove = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(null)
    setPreviewUrl(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    onChange(null)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id || name} className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
        {activeUrl && (
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {selectedFile ? "Selected" : "Uploaded"}
          </Badge>
        )}
      </div>

      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}

      {/* Hidden file input for system picker */}
      <input
        id={id || name}
        name={name}
        ref={fileInputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleSystemFileChange}
        className="hidden"
      />

      {/* Upload Box when no file is active */}
      {!activeUrl ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled) setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            if (!disabled && e.dataTransfer.files?.[0]) {
              const file = e.dataTransfer.files[0]
              if (file.type.startsWith("image/")) {
                setFileToCrop(file)
                setCropperModalOpen(true)
              } else {
                processAndSetFile(file)
              }
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all select-none text-center bg-purple-50/20 border-purple-200/80 hover:bg-purple-50/40 hover:border-purple-300",
            isDragging && "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 border border-blue-100">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="p-2.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-600 border border-purple-100">
              <Camera className="w-5 h-5" />
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
            Upload from device or take a photo
          </p>
          <p className="text-[11px] text-muted-foreground mb-4">
            {imagesOnly ? `Image only (JPG, PNG, WebP) up to ${maxSizeMb}MB` : `PDF or Image (Max ${maxSizeMb}MB)`}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="h-9 px-4 text-xs rounded-xl flex items-center gap-1.5 bg-white shadow-2xs hover:bg-slate-50"
            >
              <UploadCloud className="w-4 h-4 text-blue-600" />
              Browse Files
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setCameraModalOpen(true)}
              className="h-9 px-4 text-xs rounded-xl flex items-center gap-1.5 bg-white shadow-2xs hover:bg-slate-50 text-purple-700 border-purple-200"
            >
              <Camera className="w-4 h-4 text-purple-600" />
              Take Photo
            </Button>
          </div>
        </div>
      ) : (
        /* Preview Card when file exists */
        <div className="flex items-center justify-between p-3.5 border rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border shadow-2xs",
                isPdf ? "bg-red-50 text-red-600 border-red-200" : isImage ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-slate-50 text-slate-600 border-slate-200"
              )}
            >
              {isPdf ? (
                <div className="flex flex-col items-center justify-center">
                  <FileText className="w-5 h-5 text-red-600" />
                  <span className="text-[8px] font-bold text-red-600 mt-0.5">PDF</span>
                </div>
              ) : isImage && activeUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={activeUrl} alt={label} className="w-full h-full object-cover" />
              ) : (
                <FileText className="w-5 h-5 text-slate-500" />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px] sm:max-w-[260px]">
                {selectedFile?.name || `${label} Document`}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>{isPdf ? "PDF Document" : "Image File"}</span>
                {selectedFile?.size && (
                  <span>• {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                )}
                {!selectedFile && currentUrl && (
                  <span className="italic text-emerald-600 font-medium">• Current file</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Crop Button (only for images) */}
            {isImage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedFile) {
                    setFileToCrop(selectedFile)
                    setCropperModalOpen(true)
                  } else if (activeUrl) {
                    // Fetch remote blob to crop
                    fetch(activeUrl)
                      .then((res) => res.blob())
                      .then((blob) => {
                        const file = new File([blob], `${name}-adjust.jpg`, { type: blob.type || "image/jpeg" })
                        setFileToCrop(file)
                        setCropperModalOpen(true)
                      })
                      .catch(() => {
                        // If CORS blocks fetch, user can re-upload or view
                        setViewModalOpen(true)
                      })
                  }
                }}
                className="h-8 px-2 text-xs rounded-lg flex items-center gap-1 text-blue-600 hover:bg-blue-50"
                title="Crop or Rotate"
              >
                <Crop className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Crop</span>
              </Button>
            )}

            {/* View Preview Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewModalOpen(true)}
              className="h-8 px-2 text-xs rounded-lg flex items-center gap-1"
              title="View full document"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View</span>
            </Button>

            {/* Change File Trigger (opens file selector or camera) */}
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-slate-800"
                title="Choose different file"
              >
                Change
              </Button>
            )}

            {/* Remove Button */}
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400 mt-1 animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        open={cameraModalOpen}
        onOpenChange={setCameraModalOpen}
        onPhotoCaptured={handleCameraPhoto}
        facingMode={cameraFacingMode}
        guideType={cameraGuideType}
        title={`Take Photo - ${label}`}
      />

      {/* Image Cropper Modal */}
      <ImageCropperModal
        open={cropperModalOpen}
        onOpenChange={setCropperModalOpen}
        imageFile={fileToCrop}
        onCropComplete={handleCropComplete}
        aspectRatio={cropAspectRatio}
        title={`Crop & Frame - ${label}`}
      />

      {/* View Preview Dialog */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[88vh] flex flex-col p-4 sm:p-6 overflow-hidden rounded-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {isPdf ? <FileText className="w-5 h-5 text-red-600" /> : <ImageIcon className="w-5 h-5 text-blue-600" />}
              {label} Preview
            </DialogTitle>
            {activeUrl && (
              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={selectedFile?.name || `${label}`}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mr-6"
              >
                <Download className="w-3.5 h-3.5" />
                Open / Download
              </a>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto flex items-center justify-center p-2 min-h-[300px] max-h-[65vh]">
            {activeUrl && (
              isPdf ? (
                <iframe
                  src={`${activeUrl}#toolbar=0`}
                  title={label}
                  className="w-full h-[60vh] rounded-xl border"
                />
              ) : isImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={activeUrl}
                  alt={label}
                  className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-sm"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mb-2 text-slate-400" />
                  <p className="text-sm">Document preview is not available for this format.</p>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
