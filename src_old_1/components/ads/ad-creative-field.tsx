"use client"

import { useState, useRef, useEffect } from "react"
import { Label } from "@/ui/label"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Upload, Link as LinkIcon, ImageIcon, Video } from "lucide-react"

const MAX_MB = 5
const MAX_BYTES = MAX_MB * 1024 * 1024
const IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp"
const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime"

import { getYoutubeEmbedUrl } from "@/lib/youtube"

type Props = {
  uploadEndpoint?: string
}

export function AdCreativeField(_props: Props) {
  const [creativeType, setCreativeType] = useState<"IMAGE" | "VIDEO">("IMAGE")
  const [imageMode, setImageMode] = useState<"url" | "upload">("upload")
  const [videoMode, setVideoMode] = useState<"url" | "upload">("upload")
  const [imageUrl, setImageUrl] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [imagePreviewBlob, setImagePreviewBlob] = useState<string | null>(null)
  const [videoPreviewBlob, setVideoPreviewBlob] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const imageFileRef = useRef<HTMLInputElement>(null)
  const videoFileRef = useRef<HTMLInputElement>(null)

  // Revoke object URLs on unmount or when changing
  useEffect(() => {
    return () => {
      if (imagePreviewBlob) URL.revokeObjectURL(imagePreviewBlob)
      if (videoPreviewBlob) URL.revokeObjectURL(videoPreviewBlob)
    }
  }, [imagePreviewBlob, videoPreviewBlob])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, type: "IMAGE" | "VIDEO") {
    const file = e.target.files?.[0]
    setUploadError(null)
    if (type === "IMAGE") {
      if (imagePreviewBlob) URL.revokeObjectURL(imagePreviewBlob)
      setImagePreviewBlob(null)
    } else {
      if (videoPreviewBlob) URL.revokeObjectURL(videoPreviewBlob)
      setVideoPreviewBlob(null)
    }
    if (!file) return
    if (file.size > MAX_BYTES) {
      setUploadError(`File must be under ${MAX_MB} MB.`)
      e.target.value = ""
      return
    }
    const blobUrl = URL.createObjectURL(file)
    if (type === "IMAGE") setImagePreviewBlob(blobUrl)
    else setVideoPreviewBlob(blobUrl)
  }

  const imagePreview = imageMode === "upload" ? imagePreviewBlob : imageUrl
  const videoPreview = videoMode === "upload" ? videoPreviewBlob : videoUrl

  return (
    <div className="space-y-4">
      <Label>Creative (image or video) *</Label>

      {/* Toggle 1: Creative type = Image | Video */}
      <div className="flex gap-4 p-3 rounded-lg border bg-muted/40">
        <button
          type="button"
          onClick={() => { setCreativeType("IMAGE"); setUploadError(null); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${creativeType === "IMAGE" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <ImageIcon className="h-4 w-4" />
          Image
        </button>
        <button
          type="button"
          onClick={() => { setCreativeType("VIDEO"); setUploadError(null); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${creativeType === "VIDEO" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <Video className="h-4 w-4" />
          Video
        </button>
      </div>

      {creativeType === "IMAGE" ? (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <p className="text-sm text-muted-foreground">Image creative</p>
          <div className="flex gap-4 p-2 rounded-lg border bg-muted/30">
            <button
              type="button"
              onClick={() => { setImageMode("upload"); setUploadError(null); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${imageMode === "upload" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <Upload className="h-4 w-4" />
              Upload image (max {MAX_MB} MB)
            </button>
            <button
              type="button"
              onClick={() => { setImageMode("url"); setUploadError(null); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${imageMode === "url" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <LinkIcon className="h-4 w-4" />
              Via link
            </button>
          </div>
          {imageMode === "url" ? (
            <>
              <Input
                id="creativeUrl"
                name="creativeUrl"
                type="url"
                required
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
              {imageUrl && (
                <div className="rounded-md border overflow-hidden bg-muted/30 aspect-video max-w-sm">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" onError={() => {}} />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <input
                ref={imageFileRef}
                type="file"
                name="creativeFile"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => handleFileSelect(e, "IMAGE")}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => imageFileRef.current?.click()}
                >
                  Choose image
                </Button>
              </div>
              {imagePreview && (
                <div className="rounded-md border overflow-hidden bg-muted/30 aspect-video max-w-sm">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                </div>
              )}
              <p className="text-xs text-muted-foreground">JPEG, PNG, GIF, WebP. Max 5 MB. File uploads when you click Save.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          <p className="text-sm text-muted-foreground">Video creative</p>
          <div className="flex gap-4 p-2 rounded-lg border bg-muted/30">
            <button
              type="button"
              onClick={() => { setVideoMode("upload"); setUploadError(null); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${videoMode === "upload" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <Upload className="h-4 w-4" />
              Upload video (max {MAX_MB} MB)
            </button>
            <button
              type="button"
              onClick={() => { setVideoMode("url"); setUploadError(null); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${videoMode === "url" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <LinkIcon className="h-4 w-4" />
              Via link
            </button>
          </div>
          {videoMode === "url" ? (
            <>
              <Input
                id="creativeUrl"
                name="creativeUrl"
                type="url"
                required
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
              />
              {videoUrl && (() => {
                const embedUrl = getYoutubeEmbedUrl(videoUrl)
                return (
                  <div className="rounded-md border overflow-hidden bg-muted/30 aspect-video max-w-sm">
                    {embedUrl ? (
                      <iframe
                        src={embedUrl}
                        title="Video preview"
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video src={videoUrl} controls className="w-full h-full object-contain" />
                    )}
                  </div>
                )
              })()}
            </>
          ) : (
            <div className="space-y-2">
              <input
                ref={videoFileRef}
                type="file"
                name="creativeFile"
                accept={VIDEO_ACCEPT}
                className="hidden"
                onChange={(e) => handleFileSelect(e, "VIDEO")}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => videoFileRef.current?.click()}
                >
                  Choose video
                </Button>
              </div>
              {videoPreview && (
                <div className="rounded-md border overflow-hidden bg-muted/30 aspect-video max-w-sm">
                  <video src={videoPreview} controls className="w-full h-full object-contain" />
                </div>
              )}
              <p className="text-xs text-muted-foreground">MP4, WebM. Max 5 MB. File uploads when you click Save.</p>
            </div>
          )}
        </div>
      )}

      <input type="hidden" name="creativeType" value={creativeType} readOnly />
      {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
    </div>
  )
}
