import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { auth } from "@/lib/auth"
import { uploadPublicFile } from "@/lib/upload-public-file"

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.CUSTOMER) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File size must be between 1 byte and 5 MB" }, { status: 400 })
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid image type. Use JPEG, PNG, WebP or GIF." }, { status: 400 })
  }

  try {
    const bytes = await file.arrayBuffer()
    const ext = path.extname(file.name) || ".jpg"
    const url = await uploadPublicFile({
      folder: "review-images",
      ext,
      contentType: file.type,
      buffer: Buffer.from(bytes),
      prefix: "review",
    })
    return NextResponse.json({ url })
  } catch (error) {
    console.error("Review image upload failed:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

