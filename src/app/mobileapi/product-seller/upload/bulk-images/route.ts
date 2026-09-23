import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { verifyMobileAuth } from "@/lib/mobile-auth-server"
import { uploadPublicFile } from "@/lib/upload-public-file"

export const dynamic = "force-dynamic"

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

/**
 * GET /mobileapi/product-seller/upload/bulk-images
 * Fetch seller's stored media images with search, status filtering, and pagination.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyMobileAuth(request, UserRole.SELLER_PRODUCT)
  if (!auth.success) return auth.errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const perPage = Math.max(1, parseInt(searchParams.get("perPage") || searchParams.get("limit") || "50", 10))
    const status = (searchParams.get("status") || "ALL").toUpperCase()
    const q = (searchParams.get("q") || "").trim()
    const fetchAll = searchParams.get("all") === "true"

    const where: any = { sellerId: auth.seller.id }

    if (status === "USED") {
      where.isUsed = true
    } else if (status === "UNUSED") {
      where.isUsed = false
    }

    if (q) {
      where.filename = { contains: q, mode: "insensitive" }
    }

    const [total, images] = await Promise.all([
      prisma.sellerMediaImage.count({ where }),
      prisma.sellerMediaImage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...(fetchAll ? {} : { skip: (page - 1) * perPage, take: perPage }),
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        images,
        pagination: {
          total,
          page: fetchAll ? 1 : page,
          perPage: fetchAll ? total : perPage,
          totalPages: fetchAll ? 1 : Math.ceil(total / perPage),
        },
      },
      // Convenience top-level field for web/client compatibility
      images,
    })
  } catch (error: any) {
    console.error("Mobile bulk images fetch error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch uploaded images" },
      { status: 500 }
    )
  }
}

/**
 * POST /mobileapi/product-seller/upload/bulk-images
 * Upload multiple (or single) images to S3 and save to sellerMediaImage table.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyMobileAuth(request, UserRole.SELLER_PRODUCT)
  if (!auth.success) return auth.errorResponse

  if (!auth.seller.isApproved) {
    return NextResponse.json(
      { success: false, error: "Your seller account is pending approval." },
      { status: 403 }
    )
  }
  if (auth.seller.isSuspended) {
    return NextResponse.json(
      { success: false, error: "Your seller account has been suspended." },
      { status: 403 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { success: false, error: "Expected multipart/form-data request" },
      { status: 400 }
    )
  }

  // Support multiple key conventions: 'files', 'file', 'images', 'image'
  let rawFiles: File[] = []
  const filesList = formData.getAll("files")
  const fileList = formData.getAll("file")
  const imagesList = formData.getAll("images")
  const imageList = formData.getAll("image")

  rawFiles = [...filesList, ...fileList, ...imagesList, ...imageList].filter(
    (item): item is File => item instanceof File && item.size > 0
  )

  if (rawFiles.length === 0) {
    return NextResponse.json(
      { success: false, error: "No image files provided. Send images under 'files' or 'file' key." },
      { status: 400 }
    )
  }

  const uploadedRecords = []
  const errors: string[] = []

  for (const file of rawFiles) {
    if (file.size > MAX_BYTES) {
      errors.push(`"${file.name}": File size exceeds 10 MB limit.`)
      continue
    }

    const type = (file.type || "").toLowerCase()
    if (!type || !ALLOWED_IMAGE_TYPES.includes(type)) {
      errors.push(`"${file.name}": Invalid file type (${type || "unknown"}). Allowed formats: JPEG, PNG, GIF, WebP.`)
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
          sellerId: auth.seller.id,
          url,
          filename: file.name || `image${ext}`,
          size: file.size,
          mimeType: contentType,
        },
      })

      uploadedRecords.push(record)
    } catch (err: any) {
      console.error("Mobile bulk image upload error for file:", file.name, err)
      errors.push(`"${file.name}": ${err.message || "Upload failed"}`)
    }
  }

  const isSuccess = uploadedRecords.length > 0
  return NextResponse.json(
    {
      success: isSuccess,
      data: {
        images: uploadedRecords,
        count: uploadedRecords.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      // Convenience top-level fields for compatibility
      images: uploadedRecords,
      errors: errors.length > 0 ? errors : undefined,
    },
    { status: isSuccess ? 200 : 400 }
  )
}

/**
 * DELETE /mobileapi/product-seller/upload/bulk-images
 * Delete single or multiple images by ID.
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyMobileAuth(request, UserRole.SELLER_PRODUCT)
  if (!auth.success) return auth.errorResponse

  const { searchParams } = new URL(request.url)
  const queryId = searchParams.get("id")

  let idsToDelete: string[] = []
  if (queryId) {
    idsToDelete = [queryId]
  } else {
    try {
      const body = await request.json()
      if (typeof body.id === "string" && body.id.trim()) {
        idsToDelete = [body.id.trim()]
      } else if (Array.isArray(body.ids)) {
        idsToDelete = body.ids.filter((x: any) => typeof x === "string" && x.trim())
      }
    } catch {
      // Body not provided or not JSON
    }
  }

  if (idsToDelete.length === 0) {
    return NextResponse.json(
      { success: false, error: "Image ID required. Pass ?id=<id> or JSON { id: '<id>' } / { ids: ['<id>'] }." },
      { status: 400 }
    )
  }

  try {
    // Delete only images belonging to the authenticated seller
    const deleteResult = await prisma.sellerMediaImage.deleteMany({
      where: {
        id: { in: idsToDelete },
        sellerId: auth.seller.id,
      },
    })

    if (deleteResult.count === 0) {
      return NextResponse.json(
        { success: false, error: "No matching images found or unauthorized" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: deleteResult.count,
        deletedIds: idsToDelete,
      },
      message: `${deleteResult.count} image(s) deleted successfully`,
    })
  } catch (error: any) {
    console.error("Mobile bulk image delete error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete image(s)" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /mobileapi/product-seller/upload/bulk-images
 * Toggle isUsed status for one or multiple images.
 */
export async function PATCH(request: NextRequest) {
  const auth = await verifyMobileAuth(request, UserRole.SELLER_PRODUCT)
  if (!auth.success) return auth.errorResponse

  try {
    const body = await request.json().catch(() => ({}))
    const { id, ids, isUsed } = body

    let targetIds: string[] = []
    if (typeof id === "string" && id.trim()) {
      targetIds = [id.trim()]
    } else if (Array.isArray(ids)) {
      targetIds = ids.filter((x: any) => typeof x === "string" && x.trim())
    }

    if (targetIds.length === 0 || typeof isUsed !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Invalid payload. Provide 'ids': string[] (or 'id': string) and 'isUsed': boolean." },
        { status: 400 }
      )
    }

    const updateResult = await prisma.sellerMediaImage.updateMany({
      where: {
        id: { in: targetIds },
        sellerId: auth.seller.id,
      },
      data: { isUsed },
    })

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: updateResult.count,
        isUsed,
      },
      count: updateResult.count,
      isUsed,
    })
  } catch (error: any) {
    console.error("Mobile bulk image patch error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update image status" },
      { status: 500 }
    )
  }
}
