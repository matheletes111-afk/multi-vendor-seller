import path from "path"
import { existsSync } from "fs"
import { unlink } from "fs/promises"
import { uploadPublicFile } from "@/lib/upload-public-file"

/** Server-only: delete a legacy local file under public/uploads (not S3 URLs). */
export async function deleteImageFile(imageUrl: string): Promise<boolean> {
  try {
    if (!imageUrl || !imageUrl.startsWith("/uploads/")) {
      return false
    }
    const filePath = path.join(process.cwd(), "public", imageUrl)
    if (existsSync(filePath)) {
      await unlink(filePath)
      console.log(`Deleted image: ${imageUrl}`)
      return true
    }
    return false
  } catch (error) {
    console.error("Error deleting image:", error)
    return false
  }
}

function extFromMime(mimeType: string): string {
  const m = mimeType.toLowerCase()
  if (m.includes("png")) return ".png"
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg"
  if (m.includes("webp")) return ".webp"
  if (m.includes("gif")) return ".gif"
  return ".jpg"
}

/** Save a base64 data-URL image to public storage (AWS S3 via uploadPublicFile). */
export async function saveBase64Image(
  base64String: string,
  folder: string
): Promise<string | null> {
  try {
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) {
      console.log("Invalid base64 image format")
      return null
    }
    const imageBuffer = Buffer.from(matches[2], "base64")
    const mimeType = matches[1]
    const contentType = mimeType.includes("/") ? mimeType : `image/${mimeType}`
    const ext = extFromMime(mimeType)

    const url = await uploadPublicFile({
      folder,
      ext,
      contentType,
      buffer: imageBuffer,
      prefix: "base64",
    })
    console.log(`Saved base64 image: ${url}`)
    return url
  } catch (error) {
    console.error("Error saving image:", error)
    return null
  }
}
