import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isProductSeller, isServiceSeller } from "@/lib/rbac"
import path from "path"
import { uploadPublicFile } from "@/lib/upload-public-file"

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]
const ALLOWED = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]

function getExtFromMime(type: string): string {
  const t = type.toLowerCase()
  if (t.includes("png")) return ".png"
  if (t.includes("jpeg") || t.includes("jpg")) return ".jpg"
  if (t.includes("webp")) return ".webp"
  if (t.includes("gif")) return ".gif"
  if (t.includes("webm")) return ".webm"
  if (t.includes("quicktime")) return ".mov"
  if (t.includes("mp4")) return ".mp4"
  return t.startsWith("video/") ? ".mp4" : ".jpg"
}

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user || (!isProductSeller(session.user) && !isServiceSeller(session.user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 5 MB." },
      { status: 400 }
    )
  }

  const type = file.type?.toLowerCase()
  if (!type || !ALLOWED.includes(type)) {
    return NextResponse.json(
      { error: "Invalid file type. Use image (JPEG, PNG, GIF, WebP) or video (MP4, WebM)." },
      { status: 400 }
    )
  }

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const contentType = file.type || "application/octet-stream"
    const extFromName = path.extname((file as { name?: string }).name || "")
    const ext = extFromName || getExtFromMime(type)

    const url = await uploadPublicFile({
      folder: "seller-ads",
      ext,
      contentType,
      buffer,
      prefix: "ad",
    })

    return NextResponse.json({ url })
  } catch (err) {
    console.error("Ad creative upload error:", err)
    const message = err instanceof Error ? err.message : "Failed to upload file"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
