import path from "path"
import { uploadPublicFile } from "@/lib/upload-public-file"

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/tiff",
]

const ALLOWED_IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".heic",
  ".heif",
  ".bmp",
  ".tiff",
  ".tif",
])

function extFromType(ct?: string | null): string {
  const t = (ct || "").toLowerCase().trim()
  if (t.includes("png")) return ".png"
  if (t.includes("jpeg") || t.includes("jpg")) return ".jpg"
  if (t.includes("webp")) return ".webp"
  if (t.includes("gif")) return ".gif"
  if (t.includes("avif")) return ".avif"
  if (t.includes("heic")) return ".heic"
  if (t.includes("heif")) return ".heif"
  if (t.includes("bmp")) return ".bmp"
  if (t.includes("tiff") || t.includes("tif")) return ".tiff"
  return ".jpg"
}

async function uploadBlobParts(parts: FormDataEntryValue[], folder: string, prefix: string): Promise<string[]> {
  const urls: string[] = []
  for (const part of parts) {
    if (!part || typeof (part as Blob).arrayBuffer !== "function") continue
    const blob = part as Blob
    if (blob.size === 0) continue
    if (blob.size > MAX_BYTES) throw new Error("Each image must be 10 MB or less.")
    const fileName = (part as File).name || ""
    const fileExt = path.extname(fileName).toLowerCase()
    const type = ((part as File).type || "").toLowerCase().trim()

    const isAllowedMime = type ? ALLOWED_IMAGE_TYPES.includes(type) : false
    const isAllowedExt = fileExt ? ALLOWED_IMAGE_EXTS.has(fileExt) : false

    if (!isAllowedMime && !isAllowedExt) {
      throw new Error("Invalid image format. Allowed: JPEG, PNG, WebP, GIF, AVIF, HEIC, HEIF, BMP, TIFF.")
    }

    const buffer = Buffer.from(await blob.arrayBuffer())
    const ext = fileExt || extFromType(type)
    urls.push(
      await uploadPublicFile({
        folder,
        ext,
        contentType: type || "image/jpeg",
        buffer,
        prefix,
      })
    )
  }
  return urls
}

/** Single master/cover image from `masterImage` file part. */
export async function uploadMasterServiceImage(formData: FormData): Promise<string | null> {
  const part = formData.get("masterImage")
  if (!part || typeof (part as Blob).arrayBuffer !== "function") return null
  const urls = await uploadBlobParts([part], "services", "service")
  return urls[0] ?? null
}

/** Gallery images from `serviceGalleryImages` file parts. */
export async function uploadServiceGalleryImages(formData: FormData): Promise<string[]> {
  return uploadBlobParts(formData.getAll("serviceGalleryImages"), "services", "service-gallery")
}

/** @deprecated Use uploadMasterServiceImage + uploadServiceGalleryImages */
export async function uploadServiceFormImages(formData: FormData): Promise<string[]> {
  return uploadBlobParts(formData.getAll("serviceImages"), "services", "service")
}
