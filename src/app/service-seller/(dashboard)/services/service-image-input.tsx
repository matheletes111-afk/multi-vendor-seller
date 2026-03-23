"use client"

import { useEffect, useRef, useState } from "react"
import { Label } from "@/ui/label"
import { Button } from "@/ui/button"
import { Upload, ImagePlus } from "lucide-react"

/**
 * File upload only (no URL field). On edit, existing URLs are preserved via a hidden `images` field.
 */
export function ServiceImageInput({
  defaultUrls = [],
  label = "Images",
  hint = "Choose images — they upload when you submit the form.",
}: {
  defaultUrls?: string[]
  label?: string
  hint?: string
}) {
  const [previews, setPreviews] = useState<string[]>([])
  const blobUrls = useRef<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      blobUrls.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    blobUrls.current.forEach((u) => URL.revokeObjectURL(u))
    blobUrls.current = []
    const files = e.target.files
    if (!files?.length) {
      setPreviews([])
      return
    }
    const next: string[] = []
    for (let i = 0; i < files.length; i++) {
      const u = URL.createObjectURL(files[i])
      blobUrls.current.push(u)
      next.push(u)
    }
    setPreviews(next)
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

      {defaultUrls.length > 0 && (
        <input type="hidden" name="images" defaultValue={defaultUrls.join("\n")} />
      )}

      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-1.5">
          <Upload className="h-4 w-4" />
          Upload images
        </Label>
        <input
          ref={fileInputRef}
          type="file"
          name="serviceImages"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={onFilesChange}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          Choose images
        </Button>
      </div>

      {(defaultUrls.length > 0 || previews.length > 0) && (
        <div className="space-y-3 pt-1">
          {defaultUrls.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-3">
                {defaultUrls.map((url) => (
                  <div
                    key={url}
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted ring-2 ring-offset-2 ring-ring/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {previews.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">New selection ({previews.length})</p>
              <div className="flex flex-wrap gap-3">
                {previews.map((src) => (
                  <div
                    key={src}
                    className="h-16 w-16 shrink-0 rounded-full border-2 border-dashed border-primary/40 bg-muted overflow-hidden ring-2 ring-offset-2 ring-primary/20"
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
