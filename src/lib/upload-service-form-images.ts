import path from "path"
import { uploadPublicFile } from "@/lib/upload-public-file"

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"]

function extFromType(ct?: string | null) {
  const t = (ct || "").toLowerCase()
  if (t.includes("png")) return ".png"
  if (t.includes("jpeg") || t.includes("jpg")) return ".jpg"
  if (t.includes("webp")) return ".webp"
  if (t.includes("gif")) return ".gif"
  return ".jpg"
}

async function uploadBlobParts(parts: FormDataEntryValue[], folder: string, prefix: string): Promise<string[]> {
  const urls: string[] = []
  for (const part of parts) {
    if (!part || typeof (part as Blob).arrayBuffer !== "function") continue
    const blob = part as Blob
    if (blob.size === 0) continue
    if (blob.size > MAX_BYTES) throw new Error("Each image must be 5 MB or less.")
    const type = ((part as File).type || "image/jpeg").toLowerCase()
    if (!ALLOWED.includes(type)) throw new Error("Use JPEG, PNG, GIF, or WebP only.")
    const buffer = Buffer.from(await blob.arrayBuffer())
    const ext = path.extname((part as File).name || "") || extFromType(type)
    urls.push(
      await uploadPublicFile({
        folder,
        ext,
        contentType: type,
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
