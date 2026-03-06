"use client"

import { useState, useRef } from "react"
import { Label } from "@/ui/label"
import { Button } from "@/ui/button"
import { Upload, Link as LinkIcon, Trash2 } from "lucide-react"

function parseUrlText(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter(Boolean)
}

export function ServiceImageInput({
  name = "images",
  defaultUrls = [],
  label = "Images",
  hint = "Add via image URLs (comma or newline separated) or upload files. Multiple images supported.",
}: {
  name?: string
  defaultUrls?: string[]
  label?: string
  hint?: string
}) {
  const [linkText, setLinkText] = useState(() => (defaultUrls?.length ? defaultUrls.join("\n") : ""))
  const [uploadedUrls, setUploadedUrls] = useState<string[]>(defaultUrls)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const linkUrls = parseUrlText(linkText)
  const allUrls = Array.from(new Set([...linkUrls, ...uploadedUrls]))

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    const newUrls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith("image/")) continue
      const fd = new FormData()
      fd.append("file", file)
      try {
        const r = await fetch("/api/service-seller/upload", { method: "POST", body: fd })
        const j = await r.json().catch(() => ({}))
        if (j.url) newUrls.push(j.url)
      } catch {
        // skip
      }
    }
    if (newUrls.length > 0) setUploadedUrls((prev) => [...prev, ...newUrls])
    setUploading(false)
    e.target.value = ""
  }

  function removeUrl(url: string) {
    setUploadedUrls((prev) => prev.filter((u) => u !== url))
    setLinkText((prev) =>
      parseUrlText(prev)
        .filter((u) => u !== url)
        .join("\n")
    )
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-sm text-muted-foreground">{hint}</p>

      {/* Via link: comma or newline separated */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Image URLs</span>
        </div>
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
          value={linkText}
          onChange={(e) => setLinkText(e.target.value)}
        />
      </div>

      {/* Via upload */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? "Uploading…" : "Upload files"}
        </Button>
      </div>

      {/* Thumbnails */}
      {allUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allUrls.map((url) => (
            <div
              key={url}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-input bg-muted"
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeUrl(url)}
                className="absolute right-1 top-1 rounded bg-destructive/90 p-1 text-white hover:bg-destructive"
                aria-label="Remove"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden input for form submit: newline-separated */}
      <input type="hidden" name={name} value={allUrls.join("\n")} />
    </div>
  )
}
