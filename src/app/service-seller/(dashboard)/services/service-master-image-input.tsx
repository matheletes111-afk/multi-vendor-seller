"use client"

import { useEffect, useRef, useState } from "react"
import { Label } from "@/ui/label"
import { Button } from "@/ui/button"
import { ImageIcon, Upload, X } from "lucide-react"

/** Master/cover image — single file; uploads on form submit. Optional existing URL via hidden field. */
export function ServiceMasterImageInput({
  defaultUrl = null,
  label = "Master image",
  hint = "Main image used in listings. Uploads when you submit the form.",
}: {
  defaultUrl?: string | null
  label?: string
  hint?: string
}) {
  const [persistedUrl, setPersistedUrl] = useState(defaultUrl ?? "")
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const blobRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPersistedUrl(defaultUrl ?? "")
  }, [defaultUrl])

  useEffect(() => {
    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    }
  }, [])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current)
      blobRef.current = null
    }
    if (!f) {
      setFilePreview(null)
      return
    }
    const u = URL.createObjectURL(f)
    blobRef.current = u
    setFilePreview(u)
  }

  function clearAll() {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current)
      blobRef.current = null
    }
    setFilePreview(null)
    setPersistedUrl("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const showPreview = filePreview || persistedUrl

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-medium">{label}</Label>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>

      <input key={persistedUrl || "__empty__"} type="hidden" name="masterImageUrl" defaultValue={persistedUrl} />

      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-1.5">
          <Upload className="h-4 w-4" />
          Upload master image
        </Label>
        <input
          ref={fileInputRef}
          type="file"
          name="masterImage"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={onFileChange}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            Choose image
          </Button>
          {showPreview && (
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={clearAll}>
              <X className="h-4 w-4 mr-1" />
              Remove
            </Button>
          )}
        </div>
      </div>

      {showPreview ? (
        <div className="relative inline-block rounded-lg border-2 border-border bg-muted overflow-hidden ring-2 ring-offset-2 ring-ring/10 max-w-xs aspect-video">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={showPreview} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
      ) : (
        <div className="flex h-32 max-w-xs items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40">
          <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
        </div>
      )}
    </div>
  )
}
