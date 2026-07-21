"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card"
import { Input } from "@/ui/input"
import { Alert, AlertDescription } from "@/ui/alert"
import { Badge } from "@/ui/badge"
import { PageLoader } from "@/components/ui/page-loader"
import Checkbox from "@/ui/checkbox-v2"
import {
  ArrowLeft,
  Upload,
  Copy,
  Check,
  Trash2,
  Image as ImageIcon,
  Search,
  ExternalLink,
  RefreshCw,
  FileImage,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  CircleDot,
  Filter,
} from "lucide-react"

type MediaImage = {
  id: string
  url: string
  filename: string | null
  size: number | null
  mimeType: string | null
  isUsed: boolean
  createdAt: string
}

function formatBytes(bytes: number | null, decimals = 1) {
  if (!bytes || bytes === 0) return "0 Bytes"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

export function BulkImageUploadClient() {
  const [images, setImages] = useState<MediaImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedSelected, setCopiedSelected] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNUSED" | "USED">("ALL")
  const [isDragging, setIsDragging] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/product-seller/upload/bulk-images")
      if (!res.ok) {
        throw new Error("Failed to load images")
      }
      const data = await res.json()
      setImages(Array.isArray(data.images) ? data.images : [])
    } catch (err: any) {
      setError(err.message || "Failed to load uploaded images")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  const handleUploadFiles = async (filesList: FileList | File[]) => {
    const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"]
    const filesArray = Array.from(filesList).filter((f) => {
      if (f.type && f.type.startsWith("image/")) return true
      const ext = f.name ? f.name.substring(f.name.lastIndexOf(".")).toLowerCase() : ""
      return validExtensions.includes(ext)
    })

    if (filesArray.length === 0) {
      setError("Please select valid image files (JPEG, PNG, WebP, GIF).")
      return
    }

    setUploading(true)
    setError(null)
    setSuccessMsg(null)
    setUploadProgress({ current: 0, total: filesArray.length })

    const newlyUploaded: MediaImage[] = []
    const errMessages: string[] = []

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i]
      setUploadProgress({ current: i + 1, total: filesArray.length })

      const formData = new FormData()
      formData.append("files", file)

      try {
        const res = await fetch("/api/product-seller/upload/bulk-images", {
          method: "POST",
          body: formData,
        })
        const data = await res.json()

        if (res.ok && Array.isArray(data.images) && data.images.length > 0) {
          newlyUploaded.push(...data.images)
        } else if (data.errors && data.errors.length > 0) {
          errMessages.push(...data.errors)
        } else if (data.error) {
          errMessages.push(`"${file.name}": ${data.error}`)
        }
      } catch (err: any) {
        errMessages.push(`"${file.name}": ${err.message || "Upload failed"}`)
      }
    }

    if (newlyUploaded.length > 0) {
      setImages((prev) => {
        const newIds = new Set(newlyUploaded.map((img) => img.id))
        return [...newlyUploaded, ...prev.filter((img) => !newIds.has(img.id))]
      })
      setSuccessMsg(`Successfully uploaded ${newlyUploaded.length} image(s)!`)
    }

    if (errMessages.length > 0) {
      setError(`Some files failed to upload:\n${errMessages.join("\n")}`)
    }

    setUploading(false)
    setUploadProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files)
    }
  }

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCopyAllUrls = () => {
    if (filteredImages.length === 0) return
    const urlsText = filteredImages.map((img) => img.url).join("\n")
    navigator.clipboard.writeText(urlsText)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2500)
  }

  const handleCopySelectedUrls = () => {
    const selectedList = images.filter((img) => selectedIds.has(img.id))
    if (selectedList.length === 0) return
    const urlsText = selectedList.map((img) => img.url).join("\n")
    navigator.clipboard.writeText(urlsText)
    setCopiedSelected(true)
    setTimeout(() => setCopiedSelected(false), 2500)
  }

  const handleDeleteImage = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/product-seller/upload/bulk-images?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete image")
      }
      setImages((prev) => prev.filter((img) => img.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setSuccessMsg("Image deleted successfully.")
    } catch (err: any) {
      setError(err.message || "Failed to delete image")
    } finally {
      setDeletingId(null)
    }
  }

  const handleMarkStatus = async (targetIds: string[], isUsed: boolean) => {
    if (targetIds.length === 0) return
    setUpdatingIds((prev) => new Set([...prev, ...targetIds]))
    setError(null)

    try {
      const res = await fetch("/api/product-seller/upload/bulk-images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: targetIds, isUsed }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update image status")
      }

      setImages((prev) =>
        prev.map((img) =>
          targetIds.includes(img.id) ? { ...img, isUsed } : img
        )
      )

      setSuccessMsg(
        `Marked ${targetIds.length} image(s) as ${isUsed ? "USED" : "UNUSED"}.`
      )
    } catch (err: any) {
      setError(err.message || "Failed to update image status")
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev)
        targetIds.forEach((id) => next.delete(id))
        return next
      })
    }
  }

  // Checkbox helpers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredImages.length && filteredImages.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredImages.map((img) => img.id)))
    }
  }

  // Filter calculations
  const totalCount = images.length
  const unusedCount = images.filter((i) => !i.isUsed).length
  const usedCount = images.filter((i) => i.isUsed).length

  const filteredImages = images.filter((img) => {
    // Status filter
    if (statusFilter === "UNUSED" && img.isUsed) return false
    if (statusFilter === "USED" && !img.isUsed) return false

    // Search query filter
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      (img.filename && img.filename.toLowerCase().includes(q)) ||
      img.url.toLowerCase().includes(q)
    )
  })

  const allFilteredSelected =
    filteredImages.length > 0 &&
    filteredImages.every((img) => selectedIds.has(img.id))

  if (loading && images.length === 0) {
    return <PageLoader variant="listing" message="Loading your image library..." />
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      {/* Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild className="rounded-full shadow-xs">
            <Link href="/product-seller/products">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Bulk Product Image Upload
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                <Sparkles className="w-3 h-3 mr-1" /> Seller Tool
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Upload images to S3, get public URLs, mark used images, and copy links for bulk CSV/Excel product imports.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchImages} disabled={loading || uploading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive" className="animate-in fade-in">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert className="border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 animate-in fade-in">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Upload Zone */}
      <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors shadow-sm bg-muted/10">
        <CardContent
          className={`p-8 flex flex-col items-center justify-center text-center cursor-pointer min-h-[190px] transition-all rounded-xl ${
            isDragging ? "bg-primary/10 border-primary scale-[0.99]" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
          />

          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 text-primary group-hover:scale-110 transition-transform">
            <Upload className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-semibold mb-1">
            {isDragging ? "Drop images here to upload" : "Drag & drop product images here"}
          </h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-md">
            Supports multiple images at once (JPEG, PNG, WebP, GIF up to 10MB each).
          </p>

          <Button type="button" disabled={uploading} className="shadow-md">
            {uploading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Uploading ({uploadProgress?.current}/{uploadProgress?.total})...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                Select Images from Computer
              </>
            )}
          </Button>

          {uploadProgress && (
            <div className="w-full max-w-xs mt-4">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{
                    width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Images Gallery & List */}
      <Card className="shadow-lg border-muted/40">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <FileImage className="h-5 w-5 text-primary" />
                Uploaded Image Library
                <Badge variant="outline" className="ml-2 font-medium">
                  {filteredImages.length} {filteredImages.length === 1 ? "Image" : "Images"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Mark images as used after copying URLs so you don't re-use the same image in future bulk uploads.
              </CardDescription>
            </div>

            {/* Filter Tabs: All, Unused, Used */}
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border self-start md:self-auto">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === "ALL"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("UNUSED")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  statusFilter === "UNUSED"
                    ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CircleDot className="w-3 h-3 text-emerald-500" />
                Unused ({unusedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("USED")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  statusFilter === "USED"
                    ? "bg-background text-slate-700 dark:text-slate-300 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-slate-500" />
                Used ({usedCount})
              </button>
            </div>
          </div>

          {/* Search Bar & Global Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t mt-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allFilteredSelected}
                  onChange={handleToggleSelectAll}
                  aria-label="Select all images"
                />
                <span className="text-xs font-medium text-muted-foreground select-none">
                  Select All ({filteredImages.length})
                </span>
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search filename or URL..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {filteredImages.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAllUrls}
                  className="h-8 text-xs font-medium"
                >
                  {copiedAll ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                      All URLs Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy All URLs
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Bulk Selection Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl animate-in fade-in mt-3">
              <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {selectedIds.size} image(s) selected
              </span>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleMarkStatus(Array.from(selectedIds), true)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Mark as Used ({selectedIds.size})
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleMarkStatus(Array.from(selectedIds), false)}
                >
                  <CircleDot className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  Mark as Unused ({selectedIds.size})
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleCopySelectedUrls}
                >
                  {copiedSelected ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Selected URLs Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy Selected URLs
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {filteredImages.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl bg-muted/5">
              <ImageIcon className="mx-auto h-12 w-12 opacity-30 mb-2" />
              <p className="text-base font-medium">No images found.</p>
              <p className="text-xs text-muted-foreground">
                {statusFilter !== "ALL"
                  ? `No images with status "${statusFilter}". Try changing the filter tab.`
                  : "Upload product images above to generate copyable S3 links."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredImages.map((img) => {
                const isSelected = selectedIds.has(img.id)
                const isUpdating = updatingIds.has(img.id)

                return (
                  <div
                    key={img.id}
                    className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-xl border transition-all shadow-xs ${
                      isSelected
                        ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                        : img.isUsed
                        ? "bg-muted/30 border-muted/60 opacity-80 hover:opacity-100"
                        : "bg-card hover:bg-accent/40"
                    }`}
                  >
                    {/* Left: Checkbox, Thumbnail & Details */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleToggleSelect(img.id)}
                        aria-label={`Select ${img.filename || "image"}`}
                      />

                      <div className="relative w-14 h-14 rounded-lg overflow-hidden border bg-muted shrink-0 flex items-center justify-center group/thumb">
                        <img
                          src={img.url}
                          alt={img.filename || "Uploaded product image"}
                          className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
                          onError={(e) => {
                            ;(e.target as HTMLElement).style.display = "none"
                          }}
                        />
                        <a
                          href={img.url}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity"
                          title="Open image in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate text-foreground">
                            {img.filename || "Product Image"}
                          </p>

                          {/* Used / Unused Badge */}
                          {img.isUsed ? (
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 text-[10px] px-1.5 py-0">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-slate-500" />
                              USED
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 text-[10px] px-1.5 py-0">
                              <CircleDot className="w-3 h-3 mr-1 text-emerald-500" />
                              UNUSED
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{formatBytes(img.size)}</span>
                          <span>•</span>
                          <span>
                            {new Date(img.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: S3 URL Input */}
                    <div className="flex-1 max-w-md flex items-center gap-2">
                      <Input
                        readOnly
                        value={img.url}
                        className="text-xs font-mono bg-muted/40 h-8 select-all"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      {/* Single Item Mark Used / Unused Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isUpdating}
                        onClick={() => handleMarkStatus([img.id], !img.isUsed)}
                        className="h-8 text-xs font-medium"
                        title={img.isUsed ? "Mark as Unused" : "Mark as Used"}
                      >
                        {isUpdating ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : img.isUsed ? (
                          <span className="text-muted-foreground hover:text-emerald-600 flex items-center gap-1">
                            <CircleDot className="w-3.5 h-3.5 text-emerald-500" />
                            Unmark
                          </span>
                        ) : (
                          <span className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mark Used
                          </span>
                        )}
                      </Button>

                      {/* Copy URL Button */}
                      <Button
                        variant={copiedId === img.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleCopyUrl(img.url, img.id)}
                        className={`h-8 text-xs ${
                          copiedId === img.id
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : ""
                        }`}
                      >
                        {copiedId === img.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copy URL
                          </>
                        )}
                      </Button>

                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deletingId === img.id}
                        onClick={() => handleDeleteImage(img.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        title="Delete image"
                      >
                        {deletingId === img.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
