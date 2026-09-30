import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { checkHotelLimit, checkHotelRoomLimit } from "@/lib/subscriptions"
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

async function validateAndUploadHotelImage(file: File, folder: string, prefix: string): Promise<string> {
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
    folder,
    ext,
    contentType: file.type || "image/jpeg",
    buffer: Buffer.from(await file.arrayBuffer()),
    prefix,
  })
}

/**
 * GET /mobileapi/hotel-seller/hotels
 * List hotels with pagination and filters.
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
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const minPrice = searchParams.get("minPrice")
    const maxPrice = searchParams.get("maxPrice")
    const capacity = searchParams.get("capacity")
    const q = searchParams.get("q")
    const city = searchParams.get("city")
    const rating = searchParams.get("rating")

    const where: any = {
      hotelSellerId: seller.id,
      isDeleted: false,
    }

    if (q) {
      where.name = { contains: q, mode: "insensitive" }
    }
    if (city) {
      where.city = { contains: city, mode: "insensitive" }
    }
    if (rating) {
      where.starRating = parseInt(rating, 10)
    }

    if (minPrice || maxPrice || capacity) {
      where.rooms = {
        some: {
          isDeleted: false,
          ...(minPrice && { price: { gte: parseFloat(minPrice) } }),
          ...(maxPrice && { price: { lte: parseFloat(maxPrice) } }),
          ...(capacity && { capacityAdults: { gte: parseInt(capacity, 10) } }),
        }
      }
    }

    const [hotels, totalCount] = await Promise.all([
      prisma.hotel.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { rooms: true }
          }
        }
      }),
      prisma.hotel.count({ where }),
    ])

    const totalPages = Math.ceil(totalCount / perPage) || 1

    return NextResponse.json({
      success: true,
      data: {
        hotels,
        pagination: {
          totalCount,
          totalPages,
          page,
          perPage,
        }
      }
    })
  } catch (error: any) {
    console.error("Mobile list hotels error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /mobileapi/hotel-seller/hotels
 * Create a new hotel (supports optional embedded rooms and file uploads).
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

    const limitCheck = await checkHotelLimit(seller.id)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { success: false, error: `Hotel listing limit reached (${limitCheck.limit}). Please upgrade your plan.` },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const name = sanitizeInput(formData.get("name") as string)
    if (!name) {
      return NextResponse.json({ success: false, error: "Hotel name is required" }, { status: 400 })
    }

    const description = typeof formData.get("description") === "string" ? sanitizeInput(formData.get("description") as string) : ""
    const starRating = parseInt(formData.get("starRating") as string, 10) || 0
    const amenitiesRaw = formData.get("amenities") as string
    const checkInPolicy = typeof formData.get("checkInPolicy") === "string" ? sanitizeInput(formData.get("checkInPolicy") as string) : ""
    const checkOutPolicy = typeof formData.get("checkOutPolicy") === "string" ? sanitizeInput(formData.get("checkOutPolicy") as string) : ""
    const address = typeof formData.get("address") === "string" ? sanitizeInput(formData.get("address") as string) : ""
    const city = typeof formData.get("city") === "string" ? sanitizeInput(formData.get("city") as string) : ""
    const state = typeof formData.get("state") === "string" ? sanitizeInput(formData.get("state") as string) : ""
    const lat = parseFloat(formData.get("lat") as string) || null
    const lng = parseFloat(formData.get("lng") as string) || null

    const roomsRaw = formData.get("rooms") as string
    const roomsList = roomsRaw ? JSON.parse(roomsRaw) : []

    // Sanitize rooms items
    for (const r of roomsList) {
      if (typeof r.name === "string") r.name = sanitizeInput(r.name)
      if (typeof r.description === "string") r.description = sanitizeInput(r.description)
      if (Array.isArray(r.amenities)) {
        r.amenities = r.amenities.map((a: string) => sanitizeInput(a))
      }
    }

    // Check room limits if rooms are being created inline
    if (roomsList.length > 0) {
      const roomLimitCheck = await checkHotelRoomLimit(seller.id)
      const existingRoomsCount = roomLimitCheck.current
      const newRoomsCount = roomsList.length
      if (roomLimitCheck.limit !== null && (existingRoomsCount + newRoomsCount) > roomLimitCheck.limit) {
        return NextResponse.json(
          { success: false, error: `Room listing limit reached (Limit: ${roomLimitCheck.limit}, Current: ${existingRoomsCount}). Cannot add ${newRoomsCount} more rooms. Please upgrade your plan.` },
          { status: 403 }
        )
      }
    }

    const imageFiles = formData.getAll("images") as File[]
    const logoFile = formData.get("logo") as File | null
    const bannerFile = formData.get("banner") as File | null

    const amenities = amenitiesRaw ? JSON.parse(amenitiesRaw) : []

    // Upload hotel images to S3
    const imageUrls: string[] = []
    for (const file of imageFiles) {
      if (file && file.size > 0) {
        const url = await validateAndUploadHotelImage(file, "hotels/gallery", "hotel-img")
        imageUrls.push(url)
      }
    }

    let logoUrl = null
    if (logoFile && logoFile.size > 0) {
      logoUrl = await validateAndUploadHotelImage(logoFile, "hotels/logos", "hotel-logo")
    }

    let bannerUrl = null
    if (bannerFile && bannerFile.size > 0) {
      bannerUrl = await validateAndUploadHotelImage(bannerFile, "hotels/banners", "hotel-banner")
    }

    // Upload room images first
    const roomsWithUploadedImages: { roomData: any; roomImageUrls: string[] }[] = []
    for (let i = 0; i < roomsList.length; i++) {
      const roomData = roomsList[i]
      const roomImages = formData.getAll(`room_${i}_images`) as File[]
      const roomImageUrls: string[] = []

      for (const file of roomImages) {
        if (file && file.size > 0) {
          const url = await validateAndUploadHotelImage(file, "rooms/gallery", "room-img")
          roomImageUrls.push(url)
        }
      }
      roomsWithUploadedImages.push({
        roomData,
        roomImageUrls,
      })
    }

    const hotel = await prisma.$transaction(async (tx) => {
      const createdHotel = await tx.hotel.create({
        data: {
          hotelSellerId: seller.id,
          name,
          description,
          starRating,
          amenities,
          checkInPolicy,
          checkOutPolicy,
          address,
          city,
          state,
          lat,
          lng,
          images: imageUrls as any,
          logo: logoUrl,
          banner: bannerUrl,
        },
      })

      // Create rooms
      for (const item of roomsWithUploadedImages) {
        const { roomData, roomImageUrls } = item
        await tx.room.create({
          data: {
            hotelId: createdHotel.id,
            name: roomData.name,
            description: roomData.description,
            price: parseFloat(roomData.price) || 0,
            capacityAdults: parseInt(roomData.capacityAdults, 10) || 2,
            capacityChildren: parseInt(roomData.capacityChildren, 10) || 0,
            totalRooms: parseInt(roomData.totalRooms, 10) || 1,
            amenities: roomData.amenities || [],
            images: roomImageUrls as any,
          }
        })
      }

      return createdHotel
    })

    return NextResponse.json({ success: true, data: hotel })
  } catch (error: any) {
    console.error("Mobile create hotel error:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to create hotel" }, { status: 500 })
  }
}
