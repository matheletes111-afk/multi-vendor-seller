import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../../_helpers/hotel-restaurant-seller-auth"
import { uploadPublicFile } from "@/lib/upload-public-file"
import path from "path"
import { sanitizeInput } from "@/lib/html-sanitization"

export const dynamic = 'force-dynamic'

/**
 * GET /mobileapi/hotel-seller/rooms/[id]
 * Get single room details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

    const room = await prisma.room.findUnique({
      where: { id: id, isDeleted: false },
      include: { hotel: true }
    })

    if (!room || room.hotel.hotelSellerId !== seller.id || room.hotel.isDeleted) {
      return NextResponse.json({ success: false, error: "Room not found or unauthorized" }, { status: 404 })
    }

    // Omit nested hotel object from data or return it cleanly
    return NextResponse.json({ success: true, data: room })
  } catch (error) {
    console.error("Mobile get room error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /mobileapi/hotel-seller/rooms/[id]
 * Update an existing room details (supports S3 image uploads).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

    const existingRoom = await prisma.room.findUnique({
      where: { id: id, isDeleted: false },
      include: { hotel: true }
    })

    if (!existingRoom || existingRoom.hotel.hotelSellerId !== seller.id || existingRoom.hotel.isDeleted) {
      return NextResponse.json({ success: false, error: "Room not found or unauthorized" }, { status: 404 })
    }

    const formData = await request.formData()

    const name = typeof formData.get("name") === "string" ? sanitizeInput(formData.get("name") as string) : ""
    const description = typeof formData.get("description") === "string" ? sanitizeInput(formData.get("description") as string) : ""
    const priceRaw = formData.get("price") as string
    const price = priceRaw ? parseFloat(priceRaw) : undefined
    const capacityAdultsRaw = formData.get("capacityAdults") as string
    const capacityAdults = capacityAdultsRaw ? parseInt(capacityAdultsRaw, 10) : undefined
    const capacityChildrenRaw = formData.get("capacityChildren") as string
    const capacityChildren = capacityChildrenRaw ? parseInt(capacityChildrenRaw, 10) : undefined
    const totalRoomsRaw = formData.get("totalRooms") as string
    const totalRooms = totalRoomsRaw ? parseInt(totalRoomsRaw, 10) : undefined
    const amenitiesRaw = formData.get("amenities") as string
    const amenities = amenitiesRaw ? JSON.parse(amenitiesRaw) : undefined

    const existingImagesRaw = formData.get("existingImages") as string // JSON array of URLs to keep
    const newImageFiles = formData.getAll("newImages") as File[]

    const existingImages = existingImagesRaw ? JSON.parse(existingImagesRaw) : (existingRoom.images as string[])
    const imageUrls: string[] = [...existingImages]

    for (const file of newImageFiles) {
      if (file && file.size > 0) {
        const url = await uploadPublicFile({
          folder: "rooms/gallery",
          ext: path.extname(file.name) || ".jpg",
          contentType: file.type || "image/jpeg",
          buffer: Buffer.from(await file.arrayBuffer()),
          prefix: "room-img",
        })
        imageUrls.push(url)
      }
    }

    const updatedRoom = await prisma.room.update({
      where: { id: id },
      data: {
        name: name || undefined,
        description: description || undefined,
        price,
        capacityAdults,
        capacityChildren,
        totalRooms,
        amenities: amenities as any,
        images: imageUrls as any,
      }
    })

    return NextResponse.json({ success: true, data: updatedRoom })
  } catch (error: any) {
    console.error("Mobile update room error:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to update room" }, { status: 500 })
  }
}

/**
 * DELETE /mobileapi/hotel-seller/rooms/[id]
 * Soft-delete a room.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

    const room = await prisma.room.findUnique({
      where: { id: id, isDeleted: false },
      include: { hotel: true }
    })

    if (!room || room.hotel.hotelSellerId !== seller.id || room.hotel.isDeleted) {
      return NextResponse.json({ success: false, error: "Room not found or unauthorized" }, { status: 404 })
    }

    await prisma.room.update({
      where: { id: id },
      data: { isDeleted: true }
    })

    return NextResponse.json({ success: true, message: "Room deleted successfully" })
  } catch (error) {
    console.error("Mobile delete room error:", error)
    return NextResponse.json({ success: false, error: "Failed to delete room" }, { status: 500 })
  }
}
