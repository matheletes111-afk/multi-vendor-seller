"use client"

import { useState, useRef } from "react"
import { Label } from "@/ui/label"
import { Button } from "@/ui/button"
import { Upload, Link as LinkIcon, Trash2, ImagePlus } from "lucide-react"

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
  hint = "Add image URLs (comma separated) or upload multiple images. Preview below.",
}: {
  name?: string
  defaultUrls?: string[]
  label?: string
  hint?: string
}) {
  const [linkText, setLinkText] = useState(() => (defaultUrls?.length ? defaultUrls.join(", ") : ""))
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState<"link" | "upload">(defaultUrls?.length ? "link" : "upload")
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
        .join(", ")
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ImagePlus className="h-5 w-5 text-muted-foreground" />
        <div>
          <Label className="text-base font-medium">{label}</Label>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>

      {/* Toggle: Image links | Upload */}
      <div className="flex rounded-lg border bg-muted/30 p-1 w-full sm:w-auto sm:min-w-[260px]">
        <button
          type="button"
          onClick={() => setMode("link")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === "link" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LinkIcon className="h-4 w-4" />
          Via link
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="h-4 w-4" />
          Upload
        </button>
      </div>

      {mode === "link" ? (
        <div className="space-y-1.5">
          <Label className="text-sm flex items-center gap-1.5">
            <LinkIcon className="h-4 w-4" />
            Image links (comma separated)
          </Label>
          <textarea
            className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
            placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-sm flex items-center gap-1.5">
            <Upload className="h-4 w-4" />
            Upload images
          </Label>
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
              {uploading ? "Uploading…" : "Choose multiple images"}
            </Button>
          </div>
        </div>
      )}

      {/* Preview grid */}
      {allUrls.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Preview ({allUrls.length} image{allUrls.length !== 1 ? "s" : ""})</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {allUrls.map((url) => (
              <div
                key={url}
                className="relative aspect-square rounded-lg border border-input bg-muted overflow-hidden group"
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeUrl(url)}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                  aria-label="Remove image"
                >
                  <Trash2 className="h-6 w-6 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <input type="hidden" name={name} value={allUrls.join("\n")} />
    </div>
  )
}
