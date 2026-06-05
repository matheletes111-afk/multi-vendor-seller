"use client"

import { useEffect, useRef, useState } from "react"
import { Label } from "@/ui/label"
import { Button } from "@/ui/button"
import { ImagePlus, Upload, X } from "lucide-react"

/** Gallery images — multiple files + optional persisted URLs; uploads on form submit. */
export function ServiceGalleryImageInput({
  defaultUrls = [],
  label = "Gallery images",
  hint = "Additional photos. Uploads when you submit the form.",
}: {
  defaultUrls?: string[]
  label?: string
  hint?: string
}) {
  const [keptUrls, setKeptUrls] = useState<string[]>(defaultUrls)
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const blobUrls = useRef<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setKeptUrls(defaultUrls)
  }, [defaultUrls])

  useEffect(() => {
    return () => {
      blobUrls.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  async function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    blobUrls.current.forEach((u) => URL.revokeObjectURL(u))
    blobUrls.current = []
    const files = e.target.files
    if (!files?.length) {
      setNewPreviews([])
      return
    }
    try {
      const { compressImage } = await import("@/lib/image-compressor")
      
      const fileList = Array.from(files)
      const compressedFiles = await Promise.all(
        fileList.map((file) => compressImage(file))
      )

      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer()
        compressedFiles.forEach((file) => dataTransfer.items.add(file))
        fileInputRef.current.files = dataTransfer.files
      }

      const next: string[] = []
      for (const compressedFile of compressedFiles) {
        const u = URL.createObjectURL(compressedFile)
        blobUrls.current.push(u)
        next.push(u)
      }
      setNewPreviews(next)
    } catch {
      // Fallback
      const next: string[] = []
      for (let i = 0; i < files.length; i++) {
        const u = URL.createObjectURL(files[i])
        blobUrls.current.push(u)
        next.push(u)
      }
      setNewPreviews(next)
    }
  }

  function removeKeptAt(index: number) {
    setKeptUrls((prev) => prev.filter((_, i) => i !== index))
  }

  function clearNewSelection() {
    blobUrls.current.forEach((u) => URL.revokeObjectURL(u))
    blobUrls.current = []
    setNewPreviews([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ImagePlus className="h-5 w-5 text-muted-foreground" />
        <div>
          <Label className="text-base font-medium">{label}</Label>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>

      <input
        key={`${keptUrls.length}:${keptUrls.join("|")}`}
        type="hidden"
        name="galleryImageUrls"
        defaultValue={keptUrls.join("\n")}
      />

      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-1.5">
          <Upload className="h-4 w-4" />
          Add gallery images
        </Label>
        <input
          ref={fileInputRef}
          type="file"
          name="serviceGalleryImages"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={onFilesChange}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            Choose images
          </Button>
          {newPreviews.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearNewSelection}>
              Clear new selection
            </Button>
          )}
        </div>
      </div>

      {(keptUrls.length > 0 || newPreviews.length > 0) && (
        <div className="space-y-3 pt-1">
          {keptUrls.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Saved images — tap × to remove before update</p>
              <div className="flex flex-wrap gap-3">
                {keptUrls.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative group">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border-2 border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeKeptAt(idx)}
                      className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md opacity-90 hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {newPreviews.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">New selection ({newPreviews.length})</p>
              <div className="flex flex-wrap gap-3">
                {newPreviews.map((src) => (
                  <div
                    key={src}
                    className="h-24 w-24 shrink-0 rounded-lg border-2 border-dashed border-primary/40 bg-muted overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
