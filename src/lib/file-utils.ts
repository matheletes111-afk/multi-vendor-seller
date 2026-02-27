import path from "path"
import { existsSync } from "fs"
import { unlink, mkdir, writeFile } from "fs/promises"

/** Server-only: delete a file from public/uploads. */
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

/** Server-only: save base64 image to file system. */
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
    const extension = mimeType.split("/")[1]
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`
    const uploadDir = path.join(process.cwd(), "public", "uploads", folder)
    const filePath = path.join(uploadDir, fileName)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
      console.log(`Created directory: ${uploadDir}`)
    }
    await writeFile(filePath, imageBuffer)
    console.log(`Saved image: ${filePath}`)
    return `/uploads/${folder}/${fileName}`
  } catch (error) {
    console.error("Error saving image:", error)
    return null
  }
}
