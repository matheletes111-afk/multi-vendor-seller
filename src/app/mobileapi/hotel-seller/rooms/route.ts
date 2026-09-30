import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { checkHotelRoomLimit } from "@/lib/subscriptions"
import { sanitizeInput } from "@/lib/html-sanitization"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB limit for incoming images (auto-compressed down to 1-2MB WebP)
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

async function validateAndUploadRoomImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error(`File "${file.name}" is too large. Maximum allowed size is 10 MB.`)
  }

  const type = (file.type || "").toLowerCase().trim()
  const extFromName = path.extname(file.name || "").toLowerCase().trim()
  const isAllowedExt = ALLOWED_IMAGE_EXTS.includes(extFromName)
  const isAllowedMime = type && (ALLOWED_IMAGE_TYPES.includes(type) || (type.startsWith("image/") && type !== "image/svg+xml"))

  if (!isAllowedMime && !isAllowedExt) {
    throw new Error(`"${file.name}": Invalid file type. Please upload an image file (JPEG, PNG, WebP, HEIC, GIF, AVIF, BMP).`)
  }

  const ext = extFromName || (type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : ".jpg")
  return await uploadPublicFile({
    folder: "rooms/gallery",
    ext,
    contentType: file.type || "image/jpeg",
    buffer: Buffer.from(await file.arrayBuffer()),
    prefix: "room-img",
  })
}

/**
 * GET /mobileapi/hotel-seller/rooms
 * List rooms for a specific hotel.
 */
export async function GET(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_HOTEL)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.hotelSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const hotelId = searchParams.get("hotelId")

    if (!hotelId) {
      return NextResponse.json({ success: false, error: "hotelId query parameter is required" }, { status: 400 })
    }

    // Verify hotel ownership
    const hotel = await prisma.hotel.findFirst({
      where: { id: hotelId, hotelSellerId: seller.id, isDeleted: false }
    })

    if (!hotel) {
      return NextResponse.json({ success: false, error: "Hotel not found or unauthorized" }, { status: 404 })
    }

    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const where = {
      hotelId: hotelId,
      isDeleted: false,
    }

    const [rooms, totalCount] = await Promise.all([
      prisma.room.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" }
      }),
      prisma.room.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / perPage) || 1

    return NextResponse.json({
      success: true,
      data: {
        rooms,
        pagination: {
          totalCount,
          totalPages,
          page,
          perPage,
        }
      }
    })
  } catch (error) {
    console.error("Mobile list rooms error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /mobileapi/hotel-seller/rooms
 * Create a new room for a specific hotel (supports image uploads).
 */
export async function POST(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_HOTEL)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.hotelSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const hotelId = formData.get("hotelId") as string

    if (!hotelId) {
      return NextResponse.json({ success: false, error: "hotelId is required" }, { status: 400 })
    }

    // Verify hotel ownership
    const hotel = await prisma.hotel.findFirst({
      where: { id: hotelId, hotelSellerId: seller.id, isDeleted: false }
    })

    if (!hotel) {
      return NextResponse.json({ success: false, error: "Hotel not found or unauthorized" }, { status: 404 })
    }

    // Check room limit
    const roomLimitCheck = await checkHotelRoomLimit(seller.id)
    if (roomLimitCheck.limit !== null && roomLimitCheck.current >= roomLimitCheck.limit) {
      return NextResponse.json(
        { success: false, error: `Room listing limit reached (${roomLimitCheck.limit}). Please upgrade your plan.` },
        { status: 403 }
      )
    }

    const name = sanitizeInput(formData.get("name") as string)
    if (!name) {
      return NextResponse.json({ success: false, error: "Room name is required" }, { status: 400 })
    }

    const description = typeof formData.get("description") === "string" ? sanitizeInput(formData.get("description") as string) : ""
    const price = parseFloat(formData.get("price") as string) || 0
    const capacityAdults = parseInt(formData.get("capacityAdults") as string, 10) || 2
    const capacityChildren = parseInt(formData.get("capacityChildren") as string, 10) || 0
    const totalRooms = parseInt(formData.get("totalRooms") as string, 10) || 1
    const amenitiesRaw = formData.get("amenities") as string
    const amenities = amenitiesRaw ? JSON.parse(amenitiesRaw) : []

    const imageFiles = formData.getAll("images") as File[]
    const imageUrls: string[] = []

    for (const file of imageFiles) {
      if (file && file.size > 0) {
        const url = await validateAndUploadRoomImage(file)
        imageUrls.push(url)
      }
    }

    const room = await prisma.room.create({
      data: {
        hotelId,
        name,
        description,
        price,
        capacityAdults,
        capacityChildren,
        totalRooms,
        amenities,
        images: imageUrls as any,
      }
    })

    return NextResponse.json({ success: true, data: room })
  } catch (error: any) {
    console.error("Mobile create room error:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to create room" }, { status: 500 })
  }
}
