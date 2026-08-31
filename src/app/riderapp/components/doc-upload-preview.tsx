"use client"

import React, { useState, useRef, useEffect } from "react"
import { UploadCloud, FileText, Image as ImageIcon, Eye, X, CheckCircle2, AlertCircle, Download } from "lucide-react"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog"

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
}

export function DocUploadPreview({
  label,
  description,
  required = false,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  maxSizeMb = 10,
  value = null,
  onChange,
  disabled = false,
  className,
}: DocUploadPreviewProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null)
  const [mimeType, setMimeType] = useState<string | null>(() => {
    if (value) {
      if (value.toLowerCase().endsWith(".pdf")) return "application/pdf"
      return "image/jpeg"
    }
    return null
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value && !selectedFile) {
      setPreviewUrl(value)
      if (value.toLowerCase().endsWith(".pdf")) {
        setMimeType("application/pdf")
      } else {
        setMimeType("image/jpeg")
      }
    }
  }, [value, selectedFile])

  const handleFile = async (file: File | null) => {
    setError(null)
    if (!file) return

    let processedFile = file
    if (file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name)) {
      try {
        const { compressImage } = await import("@/lib/image-compressor")
        processedFile = await compressImage(file, 1200, 1200, 0.8)
      } catch (err) {
        console.error("Compression error:", err)
      }
    } else if (processedFile.size > 4.5 * 1024 * 1024) {
      setError(`File size exceeds 4.5MB limit. Please upload a smaller document.`)
      return
    }

    const type = processedFile.type || (processedFile.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg")
    setMimeType(type)
    setSelectedFile(processedFile)

    const objectUrl = URL.createObjectURL(processedFile)
    setPreviewUrl(objectUrl)
    onChange(processedFile, objectUrl)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    setSelectedFile(null)
    setPreviewUrl(null)
    setMimeType(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    onChange(null, null)
  }

  const isPdf = mimeType?.includes("pdf") || (previewUrl?.toLowerCase().includes(".pdf") ?? false)

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
        {previewUrl && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300">
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
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0] || null
          handleFile(f)
        }}
        className="hidden"
      />

      {/* Upload Box / Preview Card */}
      {!previewUrl ? (
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled) setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            if (!disabled && e.dataTransfer.files?.[0]) {
              handleFile(e.dataTransfer.files[0])
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl transition-all cursor-pointer select-none text-center",
            isDragging
              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30"
              : "border-border hover:border-blue-400 bg-card hover:bg-muted/30",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="p-2.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 mb-2">
            <UploadCloud className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-foreground">
            Click to upload or drag and drop
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            PDF, PNG, JPG, or WEBP (Max {maxSizeMb}MB)
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 border rounded-xl bg-card border-border/80 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border",
              isPdf ? "bg-red-50 text-red-600 border-red-200" : "bg-blue-50 text-blue-600 border-blue-200"
            )}>
              {isPdf ? (
                <FileText className="w-5 h-5" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUrl}
                  alt={label}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-[280px]">
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

          <div className="flex items-center gap-1.5 shrink-0">
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

      {/* Preview Dialog Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[88vh] flex flex-col p-4 sm:p-6 overflow-hidden rounded-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {isPdf ? <FileText className="w-5 h-5 text-red-600" /> : <ImageIcon className="w-5 h-5 text-blue-600" />}
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
            {previewUrl && (
              isPdf ? (
                <iframe
                  src={`${previewUrl}#toolbar=0`}
                  title={label}
                  className="w-full h-[60vh] rounded-xl border"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUrl}
                  alt={label}
                  className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-sm"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
