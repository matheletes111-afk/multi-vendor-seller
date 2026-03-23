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

/** Upload `serviceImages` file parts from a service create/update FormData. */
export async function uploadServiceFormImages(formData: FormData): Promise<string[]> {
  const parts = formData.getAll("serviceImages")
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
        folder: "services",
        ext,
        contentType: type,
        buffer,
        prefix: "service",
      })
    )
  }
  return urls
}
