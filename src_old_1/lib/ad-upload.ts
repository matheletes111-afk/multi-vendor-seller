import { writeFile, mkdir } from "fs/promises"
import path from "path"

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

export async function saveAdCreativeFile(file: File): Promise<string> {
  const check = validateAdCreativeFile(file)
  if (!check.ok) throw new Error(check.error)

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const type = file.type?.toLowerCase() ?? ""
  const ext = path.extname(file.name) || (type.startsWith("video/") ? ".mp4" : ".jpg")
  const safeName = `ad-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
  const uploadDir = path.join(process.cwd(), "public", "uploads", "seller-ads")
  await mkdir(uploadDir, { recursive: true })
  const filePath = path.join(uploadDir, safeName)
  await writeFile(filePath, buffer)
  return `/uploads/seller-ads/${safeName}`
}
