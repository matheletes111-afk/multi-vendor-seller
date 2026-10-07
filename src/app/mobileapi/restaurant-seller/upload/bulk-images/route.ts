import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../../_helpers/hotel-restaurant-seller-auth"
import { uploadPublicFile } from "@/lib/upload-public-file"

export const dynamic = "force-dynamic"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB limit per image
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

async function getMobileRestaurantSeller(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    return {
      success: false as const,
      errorResponse: NextResponse.json(
        { success: false, error: authStatus.error === "unauthorized" ? "Unauthorized" : "Forbidden" },
        { status: authStatus.error === "unauthorized" ? 401 : 403 }
      ),
    }
  }

  const seller = await prisma.restaurantSeller.findUnique({
    where: { userId: authStatus.userId },
  })
  if (!seller) {
    return {
      success: false as const,
      errorResponse: NextResponse.json(
        { success: false, error: "Restaurant seller account not found" },
        { status: 404 }
      ),
    }
  }

  return { success: true as const, seller }
}

/**
 * GET /mobileapi/restaurant-seller/upload/bulk-images
 * List stored food media images with pagination and filter support.
 */
export async function GET(request: NextRequest) {
  const auth = await getMobileRestaurantSeller(request)
  if (!auth.success) return auth.errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const perPage = Math.max(1, parseInt(searchParams.get("perPage") || searchParams.get("limit") || "50", 10))
    const status = (searchParams.get("status") || "ALL").toUpperCase()
    const q = (searchParams.get("q") || "").trim()
    const fetchAll = searchParams.get("all") === "true"

    const where: any = { restaurantSellerId: auth.seller.id }

    if (q) {
      where.filename = { contains: q, mode: "insensitive" }
    }

    if (status === "USED") {
      where.isUsed = true
    } else if (status === "UNUSED") {
      where.isUsed = false
    }

    const [total, images] = await Promise.all([
      prisma.restaurantMediaImage.count({ where }),
      prisma.restaurantMediaImage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...(fetchAll ? {} : { skip: (page - 1) * perPage, take: perPage }),
      }),
    ])

    // Detect used in foods
    const foods = await prisma.foodItem.findMany({
      where: { restaurantSellerId: auth.seller.id, isDeleted: false },
      select: { images: true },
    })
    const usedUrls = new Set<string>()
    for (const f of foods) {
      if (Array.isArray(f.images)) {
        for (const u of f.images) {
          if (typeof u === "string" && u.trim()) usedUrls.add(u.trim())
        }
      }
    }

    const enriched = images.map((img) => ({
      ...img,
      isUsed: img.isUsed || usedUrls.has(img.url.trim()),
    }))

    return NextResponse.json({
      success: true,
      images: enriched,
      pagination: {
        page: fetchAll ? 1 : page,
        perPage: fetchAll ? total : perPage,
        total,
        totalPages: fetchAll ? 1 : Math.ceil(total / perPage),
      },
    })
  } catch (error: any) {
    console.error("Mobile restaurant list images error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /mobileapi/restaurant-seller/upload/bulk-images
 * Upload images via multipart/form-data.
 */
export async function POST(request: NextRequest) {
  const auth = await getMobileRestaurantSeller(request)
  if (!auth.success) return auth.errorResponse

  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      const singleFile = formData.get("file") as File | null
      if (singleFile) files.push(singleFile)
    }

    if (files.length === 0) {
      return NextResponse.json({ success: false, error: "No files provided for upload" }, { status: 400 })
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
        const ext = extFromName || getImageExtFromContentType(contentType)

        const url = await uploadPublicFile({
          folder: "foods",
          ext,
          contentType,
          buffer,
          prefix: "food-media",
        })

        const isWebpUrl = url.toLowerCase().includes(".webp")
        const cleanName = path.parse(file.name || "image").name
        const storedFilename = isWebpUrl ? `${cleanName}.webp` : (file.name || "image" + ext)
        const storedMimeType = isWebpUrl ? "image/webp" : contentType

        const record = await prisma.restaurantMediaImage.create({
          data: {
            restaurantSellerId: auth.seller.id,
            url,
            filename: storedFilename,
            size: file.size,
            mimeType: storedMimeType,
          },
        })

        uploadedRecords.push(record)
      } catch (err: any) {
        console.error("Mobile restaurant bulk image upload error for file", file.name, err)
        errors.push(`"${file.name}": ${err.message || "Upload failed"}`)
      }
    }

    return NextResponse.json({
      success: true,
      images: uploadedRecords,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error("Mobile restaurant upload images error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /mobileapi/restaurant-seller/upload/bulk-images
 * Delete an image by id.
 */
export async function DELETE(request: NextRequest) {
  const auth = await getMobileRestaurantSeller(request)
  if (!auth.success) return auth.errorResponse

  try {
    const { searchParams } = new URL(request.url)
    let id = searchParams.get("id")

    if (!id) {
      const body = await request.json().catch(() => ({}))
      id = body.id
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "Image ID required" }, { status: 400 })
    }

    const existing = await prisma.restaurantMediaImage.findFirst({
      where: { id, restaurantSellerId: auth.seller.id },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: "Image not found or unauthorized" }, { status: 404 })
    }

    await prisma.restaurantMediaImage.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deletedId: id })
  } catch (error: any) {
    console.error("Mobile restaurant delete image error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /mobileapi/restaurant-seller/upload/bulk-images
 * Update isUsed status for bulk image IDs.
 */
export async function PATCH(request: NextRequest) {
  const auth = await getMobileRestaurantSeller(request)
  if (!auth.success) return auth.errorResponse

  try {
    const body = await request.json().catch(() => ({}))
    const { ids, isUsed } = body

    if (!Array.isArray(ids) || ids.length === 0 || typeof isUsed !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Invalid payload. 'ids' must be a non-empty array and 'isUsed' must be boolean." },
        { status: 400 }
      )
    }

    await prisma.restaurantMediaImage.updateMany({
      where: {
        id: { in: ids },
        restaurantSellerId: auth.seller.id,
      },
      data: { isUsed },
    })

    return NextResponse.json({ success: true, count: ids.length, isUsed })
  } catch (error: any) {
    console.error("Mobile restaurant patch images error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
