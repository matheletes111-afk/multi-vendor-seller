import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { uploadPublicFile } from "@/lib/upload-public-file"
import { verifyMobileAuth } from "@/lib/mobile-auth-server"
import { UserRole } from "@prisma/client"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB limit per image (auto-compressed down to 1-2MB WebP)
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
]
const ALLOWED_IMAGE_EXTS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
  ".avif",
  ".bmp",
  ".tiff",
  ".tif",
]

function getImageExtFromContentType(contentType?: string | null) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("heic")) return ".heic"
  if (ct.includes("heif")) return ".heif"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("png")) return ".png"
  if (ct.includes("gif")) return ".gif"
  if (ct.includes("avif")) return ".avif"
  if (ct.includes("bmp")) return ".bmp"
  if (ct.includes("tiff")) return ".tiff"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  return ".jpg"
}

async function getSellerIdFromSessionOrMobile(request: NextRequest): Promise<string | null> {
  const session = await auth()
  if (session?.user && isProductSeller(session.user)) {
    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    return seller?.id || null
  }

  const mobileAuth = await verifyMobileAuth(request, UserRole.SELLER_PRODUCT)
  if (mobileAuth.success) {
    return mobileAuth.seller.id
  }

  return null
}

/** GET: Fetch seller's stored media images */
export async function GET(request: NextRequest) {
  const sellerId = await getSellerIdFromSessionOrMobile(request)
  if (!sellerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const images = await prisma.sellerMediaImage.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ images })
}

/** POST: Upload images to S3 and save DB records */
export async function POST(request: NextRequest) {
  const sellerId = await getSellerIdFromSessionOrMobile(request)
  if (!sellerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    const type = (file.type || "").toLowerCase().trim()
    const extFromName = path.extname(file.name || "").toLowerCase().trim()
    const isAllowedExt = ALLOWED_IMAGE_EXTS.includes(extFromName)
    const isAllowedMime = type && (ALLOWED_IMAGE_TYPES.includes(type) || (type.startsWith("image/") && type !== "image/svg+xml"))

    if (!isAllowedMime && !isAllowedExt) {
      errors.push(`"${file.name}": Invalid file type. Use JPEG, PNG, WebP, HEIC, GIF, AVIF, or BMP.`)
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

      const isWebpUrl = url.toLowerCase().includes(".webp")
      const cleanName = path.parse(file.name || "image").name
      const storedFilename = isWebpUrl ? `${cleanName}.webp` : (file.name || "image" + ext)
      const storedMimeType = isWebpUrl ? "image/webp" : contentType

      const record = await prisma.sellerMediaImage.create({
        data: {
          sellerId,
          url,
          filename: storedFilename,
          size: file.size,
          mimeType: storedMimeType,
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
  const sellerId = await getSellerIdFromSessionOrMobile(request)
  if (!sellerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
    where: { id, sellerId },
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
  const sellerId = await getSellerIdFromSessionOrMobile(request)
  if (!sellerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
      sellerId,
    },
    data: { isUsed },
  })

  return NextResponse.json({ success: true, count: ids.length, isUsed })
}
