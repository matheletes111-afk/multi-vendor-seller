import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user || !isProductSeller(session.user)) {
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
  if (!type || !ALLOWED_IMAGE_TYPES.includes(type)) {
    return NextResponse.json(
      { error: "Invalid file type. Use JPEG, PNG, GIF, or WebP." },
      { status: 400 }
    )
  }

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = path.extname(file.name) || ".jpg"
    const safeName = `product-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
    const uploadDir = path.join(process.cwd(), "public", "uploads", "products")
    await mkdir(uploadDir, { recursive: true })
    const filePath = path.join(uploadDir, safeName)
    await writeFile(filePath, buffer)

    const url = `/uploads/products/${safeName}`
    return NextResponse.json({ url })
  } catch (err) {
    console.error("Product image upload error:", err)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}
