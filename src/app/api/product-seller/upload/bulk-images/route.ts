import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { uploadPublicFile } from "@/lib/upload-public-file"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB per image
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

function getImageExtFromContentType(contentType?: string | null) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("png")) return ".png"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  return ".jpg"
}

/** GET: Fetch seller's stored media images */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller profile not found" }, { status: 404 })
  }

  const images = await prisma.sellerMediaImage.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ images })
}

/** POST: Upload images to S3 and save DB records */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller profile not found" }, { status: 404 })
  }

  const formData = await request.formData()
  const files = formData.getAll("files") as File[]

  if (!files || files.length === 0) {
    // Check if single 'file' key was sent
    const singleFile = formData.get("file") as File | null
    if (singleFile) {
      files.push(singleFile)
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided for upload" }, { status: 400 })
  }

  const uploadedRecords = []
  const errors: string[] = []

  for (const file of files) {
    if (!file || file.size === 0) continue

    if (file.size > MAX_BYTES) {
      errors.push(`"${file.name}": File size exceeds 10 MB limit.`)
      continue
    }

    const type = file.type?.toLowerCase()
    if (!type || !ALLOWED_IMAGE_TYPES.includes(type)) {
      errors.push(`"${file.name}": Invalid file type. Use JPEG, PNG, GIF, or WebP.`)
      continue
    }

    try {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const contentType = file.type || "image/jpeg"
      const extFromName = path.extname(file.name || "")
      const ext = extFromName || getImageExtFromContentType(contentType)

      const url = await uploadPublicFile({
        folder: "products",
        ext,
        contentType,
        buffer,
        prefix: "product",
      })

      const record = await prisma.sellerMediaImage.create({
        data: {
          sellerId: seller.id,
          url,
          filename: file.name || "image" + ext,
          size: file.size,
          mimeType: contentType,
        },
      })

      uploadedRecords.push(record)
    } catch (err: any) {
      console.error("Bulk image upload error for file", file.name, err)
      errors.push(`"${file.name}": ${err.message || "Upload failed"}`)
    }
  }

  return NextResponse.json({
    images: uploadedRecords,
    errors: errors.length > 0 ? errors : undefined,
  })
}

/** DELETE: Delete a media image record by ID */
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller profile not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  let id = searchParams.get("id")

  if (!id) {
    const body = await request.json().catch(() => ({}))
    id = body.id
  }

  if (!id) {
    return NextResponse.json({ error: "Image ID required" }, { status: 400 })
  }

  // Ensure image belongs to seller
  const existing = await prisma.sellerMediaImage.findFirst({
    where: { id, sellerId: seller.id },
  })

  if (!existing) {
    return NextResponse.json({ error: "Image not found or unauthorized" }, { status: 404 })
  }

  await prisma.sellerMediaImage.delete({
    where: { id },
  })

  return NextResponse.json({ success: true, deletedId: id })
}

/** PATCH: Update isUsed status for single or bulk image IDs */
export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller profile not found" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { ids, isUsed } = body

  if (!Array.isArray(ids) || ids.length === 0 || typeof isUsed !== "boolean") {
    return NextResponse.json(
      { error: "Invalid payload. 'ids' must be a non-empty array and 'isUsed' must be boolean." },
      { status: 400 }
    )
  }

  await prisma.sellerMediaImage.updateMany({
    where: {
      id: { in: ids },
      sellerId: seller.id,
    },
    data: { isUsed },
  })

  return NextResponse.json({ success: true, count: ids.length, isUsed })
}
