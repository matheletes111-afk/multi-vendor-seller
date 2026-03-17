import path from "path"
import { mkdir, writeFile } from "fs/promises"
import { existsSync } from "fs"
import { put } from "@vercel/blob"

type UploadArgs = {
  /** Folder prefix in storage, e.g. "categories" or "subcategories" */
  folder: string
  /** File extension including dot, e.g. ".png" */
  ext: string
  /** Content type, e.g. "image/png" */
  contentType: string
  /** File bytes */
  buffer: Buffer
  /** Optional stable prefix for name */
  prefix: string
}

/**
 * Upload a file to a public URL.
 *
 * - If `BLOB_READ_WRITE_TOKEN` is present, uploads to Vercel Blob.
 * - Otherwise, writes to `public/uploads/<folder>/...` (works locally, not on serverless hosts).
 */
export async function uploadPublicFile(args: UploadArgs): Promise<string> {
  const { folder, ext, contentType, buffer, prefix } = args
  const safeExt = ext && ext.startsWith(".") ? ext : `.${String(ext || "").replace(/^\.+/, "") || "bin"}`
  const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blobPath = `uploads/${folder}/${fileName}`
    const res = await put(blobPath, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    })
    return res.url
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", folder)
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true })
  }
  const filePath = path.join(uploadDir, fileName)
  await writeFile(filePath, buffer)
  return `/uploads/${folder}/${fileName}`
}

