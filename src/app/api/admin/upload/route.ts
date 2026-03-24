import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import path from "path"
import { uploadPublicFile } from "@/lib/upload-public-file"

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

function getImageExtFromContentType(contentType?: string | null) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("png")) return ".png"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  return ".jpg"
}

/** POST /api/admin/upload — admin-only image upload (e.g. order delivery proof). */
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const purposeRaw = formData.get("purpose")
  const purpose = typeof purposeRaw === "string" ? purposeRaw.trim().toLowerCase() : ""

  let folder = "admin/misc"
  let prefix = "admin"
  if (purpose === "delivery-proof") {
    folder = "orders/delivery-proof"
    prefix = "delivery-proof"
  }

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
  if (!type || !ALLOWED_IMAGE_TYPES.includes(type)) {
    return NextResponse.json(
      { error: "Invalid file type. Use JPEG, PNG, GIF, or WebP." },
      { status: 400 }
    )
  }

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const contentType = file.type || "image/jpeg"
    const extFromName = path.extname((file as { name?: string }).name || "")
    const ext = extFromName || getImageExtFromContentType(contentType)

    const url = await uploadPublicFile({
      folder,
      ext,
      contentType,
      buffer,
      prefix,
    })

    return NextResponse.json({ url })
  } catch (err) {
    console.error("Admin upload error:", err)
    const message = err instanceof Error ? err.message : "Failed to upload file"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
