import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRequestPublicOrigin, normalizeHotelMedia, normalizeHotelSellerMedia, toPublicMediaUrlList } from "@/lib/media-url"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const origin = getRequestPublicOrigin(request)
    const room = await prisma.room.findFirst({
      where: {
        id,
        isActive: true,
        isDeleted: false
      },
      include: {
        hotel: {
          include: {
            hotelSeller: {
              select: { logo: true, banner: true, mainPhoto: true },
            },
          },
        }
      }
    })

    if (!room) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 })
    }

    const hotelMedia = room.hotel ? normalizeHotelMedia(room.hotel, origin) : null
    const formattedRoom = {
      ...room,
      images: toPublicMediaUrlList(room.images, origin),
      hotel: room.hotel && hotelMedia
        ? {
            ...room.hotel,
            hotelSeller: normalizeHotelSellerMedia(room.hotel.hotelSeller, origin),
            images: hotelMedia.images,
            banner: hotelMedia.banner,
            logo: hotelMedia.logo,
            image_url: hotelMedia.coverImage,
            coverImage: hotelMedia.coverImage,
          }
        : room.hotel,
    }

    return NextResponse.json({ success: true, data: formattedRoom })
  } catch (error) {
    console.error("Error fetching mobile room details:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
