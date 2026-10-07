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
import { compressImage } from "@/lib/image-compressor"
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
  Utensils,
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

export function RestaurantBulkImageUploadClient() {
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

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/restaurant-seller/upload/bulk-images")
      if (!res.ok) {
        throw new Error("Failed to load restaurant images")
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
    const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".avif", ".bmp", ".tiff", ".tif"]
    const filesArray = Array.from(filesList).filter((f) => {
      if (f.type && f.type.startsWith("image/")) return true
      const ext = f.name ? f.name.substring(f.name.lastIndexOf(".")).toLowerCase() : ""
      return validExtensions.includes(ext)
    })

    if (filesArray.length === 0) {
      setError("Please select valid image files (JPEG, PNG, WebP, HEIC, GIF, AVIF, BMP).")
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

      let fileToUpload = file
      try {
        // Pre-compress and convert to WebP on client side for fast network upload
        fileToUpload = await compressImage(file, 1600, 1600, 0.85)
      } catch (compErr) {
        console.warn("Client WebP compression bypassed, using original file:", compErr)
      }

      const formData = new FormData()
      formData.append("files", fileToUpload)

      try {
        const res = await fetch("/api/restaurant-seller/upload/bulk-images", {
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
      setSuccessMsg(`Successfully uploaded ${newlyUploaded.length} image${newlyUploaded.length === 1 ? "" : "s"}.`)
    }

    if (errMessages.length > 0) {
      setError(`Some files failed: ${errMessages.slice(0, 3).join(", ")}${errMessages.length > 3 ? "..." : ""}`)
    }

    setUploading(false)
    setUploadProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleCopySingle = (id: string, url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCopyAll = () => {
    const urls = filteredImages.map((img) => img.url).join(" | ")
    if (!urls) return
    navigator.clipboard.writeText(urls)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2500)
  }

  const handleCopySelected = () => {
    const selectedUrls = images
      .filter((img) => selectedIds.has(img.id))
      .map((img) => img.url)
      .join(" | ")

    if (!selectedUrls) return
    navigator.clipboard.writeText(selectedUrls)
    setCopiedSelected(true)
    setTimeout(() => setCopiedSelected(false), 2500)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this media image?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/restaurant-seller/upload/bulk-images?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete image")
      setImages((prev) => prev.filter((img) => img.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (err: any) {
      setError(err.message || "Could not delete image")
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected image(s)?`)) return

    const toDelete = Array.from(selectedIds)
    let deletedCount = 0

    for (const id of toDelete) {
      try {
        const res = await fetch(`/api/restaurant-seller/upload/bulk-images?id=${id}`, {
          method: "DELETE",
        })
        if (res.ok) deletedCount++
      } catch {}
    }

    setImages((prev) => prev.filter((img) => !selectedIds.has(img.id)))
    setSelectedIds(new Set())
    setSuccessMsg(`Deleted ${deletedCount} image(s).`)
  }

  const toggleSelectImage = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllFiltered = () => {
    if (selectedIds.size === filteredImages.length && filteredImages.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredImages.map((img) => img.id)))
    }
  }

  // Filter images
  const filteredImages = images.filter((img) => {
    if (statusFilter === "UNUSED" && img.isUsed) return false
    if (statusFilter === "USED" && !img.isUsed) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = img.filename?.toLowerCase().includes(q)
      const matchUrl = img.url.toLowerCase().includes(q)
      return matchName || matchUrl
    }
    return true
  })

  const usedCount = images.filter((img) => img.isUsed).length
  const unusedCount = images.length - usedCount

  if (loading && images.length === 0) {
    return <PageLoader message="Loading restaurant media gallery..." />
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="rounded-xl h-8 w-8 hover:bg-muted">
              <Link href="/restaurant-seller/foods">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Utensils className="h-6 w-6 text-emerald-600" />
              Restaurant Bulk Image Upload
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            Upload dish & menu photos in bulk. Copy individual or pipe-separated (<code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">|</code>) URLs directly into your bulk food Excel template.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto ml-10 sm:ml-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchImages}
            disabled={loading || uploading}
            className="rounded-xl font-medium"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            asChild
            variant="default"
            size="sm"
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20"
          >
            <Link href="/restaurant-seller/foods">Back to Food Menu</Link>
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert className="rounded-2xl border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="font-semibold">{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Upload Drag & Drop Area */}
      <Card
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setIsDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          if (e.dataTransfer.files) {
            handleUploadFiles(e.dataTransfer.files)
          }
        }}
        className={`rounded-3xl border-2 border-dashed transition-all duration-300 ${
          isDragging
            ? "border-emerald-500 bg-emerald-50/50 shadow-lg scale-[1.005]"
            : "border-muted-foreground/20 hover:border-emerald-500/50 bg-gradient-to-b from-background to-muted/20"
        }`}
      >
        <CardContent className="p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-600 shadow-inner">
            <Upload className="h-8 w-8 animate-pulse" />
          </div>

          <div className="space-y-1.5 max-w-lg">
            <h3 className="text-lg font-bold tracking-tight">Drag and drop your food photos here</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Supports JPEG, PNG, WebP, HEIC, GIF, AVIF, and BMP up to 10 MB per file.
              Images are automatically optimized and converted to high-speed WebP.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.heic,.heif,.avif,.webp,.bmp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleUploadFiles(e.target.files)
            }}
          />

          <Button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl h-11 px-6 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 transition-all"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" /> Uploading {uploadProgress?.current}/{uploadProgress?.total}...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <FileImage className="h-4 w-4" /> Browse Food Images
              </span>
            )}
          </Button>

          {uploadProgress && (
            <div className="w-full max-w-xs space-y-1.5 pt-2">
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground font-semibold">
                Uploading {uploadProgress.current} of {uploadProgress.total} images...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter and Bulk Action Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center bg-muted/60 p-1 rounded-2xl border border-border/40">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === "ALL"
                  ? "bg-background text-foreground shadow-sm font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({images.length})
            </button>
            <button
              onClick={() => setStatusFilter("UNUSED")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === "UNUSED"
                  ? "bg-amber-500 text-white shadow-sm font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Unused ({unusedCount})
            </button>
            <button
              onClick={() => setStatusFilter("USED")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === "USED"
                  ? "bg-emerald-600 text-white shadow-sm font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Used in Dishes ({usedCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] sm:min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search images by name..."
              className="pl-9 h-9 rounded-xl text-xs bg-background"
            />
          </div>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {filteredImages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAllFiltered}
              className="rounded-xl text-xs font-semibold h-9"
            >
              {selectedIds.size === filteredImages.length && filteredImages.length > 0 ? "Deselect All" : "Select All"}
            </Button>
          )}

          {selectedIds.size > 0 && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleCopySelected}
                className="rounded-xl text-xs font-bold h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                {copiedSelected ? (
                  <span className="flex items-center gap-1.5 text-white">
                    <Check className="h-3.5 w-3.5" /> Copied {selectedIds.size} URLs!
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Copy className="h-3.5 w-3.5" /> Copy Selected ({selectedIds.size}) URLs (|)
                  </span>
                )}
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                className="rounded-xl text-xs font-bold h-9"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Selected ({selectedIds.size})
              </Button>
            </>
          )}

          {filteredImages.length > 0 && selectedIds.size === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAll}
              className="rounded-xl text-xs font-semibold h-9"
            >
              {copiedAll ? (
                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                  <Check className="h-3.5 w-3.5" /> Copied All URLs!
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Copy className="h-3.5 w-3.5" /> Copy All Filtered URLs (|)
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Gallery Grid */}
      {filteredImages.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-border/60 p-12 text-center bg-muted/10">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground/60">
              <ImageIcon className="h-7 w-7" />
            </div>
            <h4 className="font-bold text-base">No media images found</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              {searchQuery || statusFilter !== "ALL"
                ? "Try clearing your search query or switching your status filter."
                : "Upload food photos above to store them in your gallery and use them in bulk menus."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {filteredImages.map((img) => {
            const isSelected = selectedIds.has(img.id)
            const isCopied = copiedId === img.id

            return (
              <Card
                key={img.id}
                className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 bg-background flex flex-col justify-between ${
                  isSelected
                    ? "ring-2 ring-emerald-500 border-emerald-500 shadow-md"
                    : "hover:border-emerald-500/40 hover:shadow-md"
                }`}
              >
                {/* Checkbox overlay top-left */}
                <div className="absolute top-2 left-2 z-10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelectImage(img.id)
                    }}
                    className={`h-6 w-6 rounded-lg flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-md"
                        : "bg-black/40 text-white/80 hover:bg-black/60 backdrop-blur-md"
                    }`}
                  >
                    {isSelected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
                  </button>
                </div>

                {/* Status Badge top-right */}
                <div className="absolute top-2 right-2 z-10">
                  {img.isUsed ? (
                    <Badge className="bg-emerald-600/90 hover:bg-emerald-600 text-white text-[9px] px-1.5 py-0 font-bold backdrop-blur-md border-none shadow-sm">
                      Used
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-500/90 hover:bg-amber-500 text-white text-[9px] px-1.5 py-0 font-bold backdrop-blur-md border-none shadow-sm">
                      Unused
                    </Badge>
                  )}
                </div>

                {/* Thumbnail Image Container */}
                <div
                  className="relative aspect-square w-full overflow-hidden bg-slate-100 cursor-pointer"
                  onClick={() => toggleSelectImage(img.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.filename || "Food media image"}
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.onerror = null
                      target.src = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80"
                    }}
                  />
                </div>

                {/* Card Info & Quick Actions */}
                <CardContent className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold text-foreground truncate" title={img.filename || "image"}>
                      {img.filename || "food-image"}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                      <span>{formatBytes(img.size)}</span>
                      <span>{new Date(img.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 pt-1 border-t border-border/40">
                    <Button
                      size="sm"
                      variant={isCopied ? "default" : "outline"}
                      onClick={() => handleCopySingle(img.id, img.url)}
                      className={`h-7 flex-1 text-[10px] font-bold rounded-lg px-1.5 transition-all ${
                        isCopied ? "bg-emerald-600 text-white hover:bg-emerald-700" : "hover:bg-muted"
                      }`}
                    >
                      {isCopied ? (
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3" /> Copied!
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Copy className="h-3 w-3" /> Copy URL
                        </span>
                      )}
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      asChild
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <a href={img.url} target="_blank" rel="noopener noreferrer" title="View full image">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={deletingId === img.id}
                      onClick={() => handleDelete(img.id)}
                      className="h-7 w-7 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                      title="Delete image"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
