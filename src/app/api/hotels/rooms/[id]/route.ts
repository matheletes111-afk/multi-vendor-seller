import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { normalizeHotelMedia, normalizeHotelSellerMedia, toPublicMediaUrlList } from "@/lib/media-url"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    const hotelMedia = room.hotel ? normalizeHotelMedia(room.hotel) : null
    return NextResponse.json({
      success: true,
      data: {
        ...room,
        images: toPublicMediaUrlList(room.images),
        hotel: room.hotel && hotelMedia
          ? {
              ...room.hotel,
              hotelSeller: normalizeHotelSellerMedia(room.hotel.hotelSeller),
              images: hotelMedia.images,
              banner: hotelMedia.banner,
              logo: hotelMedia.logo,
              coverImage: hotelMedia.coverImage,
            }
          : room.hotel,
      }
    })
  } catch (error) {
    console.error("Error fetching room details:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
