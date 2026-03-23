import path from "path"
import { uploadPublicFile } from "@/lib/upload-public-file"

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]
const ALLOWED = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]

export function validateAdCreativeFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!file || file.size === 0) return { ok: false, error: "No file provided" }
  if (file.size > MAX_BYTES) return { ok: false, error: "File too large. Maximum size is 5 MB." }
  const type = file.type?.toLowerCase()
  if (!type || !ALLOWED.includes(type)) {
    return { ok: false, error: "Invalid file type. Use image (JPEG, PNG, GIF, WebP) or video (MP4, WebM)." }
  }
  return { ok: true }
}

function getExtAndContentType(file: File): { ext: string; contentType: string } {
  const contentType = file.type || "application/octet-stream"
  const extFromName = path.extname((file as { name?: string }).name || "")
  if (extFromName) {
    const ext = extFromName.startsWith(".") ? extFromName : `.${extFromName}`
    return { ext, contentType }
  }
  const ct = contentType.toLowerCase()
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
  }
  const ext = mimeToExt[ct] || (ct.startsWith("video/") ? ".mp4" : ".jpg")
  return { ext, contentType }
}

/**
 * Save ad creative (image or video) to public storage (AWS S3 via uploadPublicFile).
 * Same env vars as other uploads: AWS_REGION, credentials, S3_BUCKET / AWS_S3_BUCKET_NAME.
 */
export async function saveAdCreativeFile(file: File): Promise<string> {
  const check = validateAdCreativeFile(file)
  if (!check.ok) throw new Error(check.error)

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const { ext, contentType } = getExtAndContentType(file)

  return uploadPublicFile({
    folder: "seller-ads",
    ext,
    contentType,
    buffer,
    prefix: "ad",
  })
}
