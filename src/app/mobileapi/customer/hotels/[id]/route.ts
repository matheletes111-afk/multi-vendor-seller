import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { activeHotelSellerWhere } from "@/lib/subscriptions"
import {
  getRequestPublicOrigin,
  normalizeHotelMedia,
  normalizeHotelSellerMedia,
  toPublicMediaUrl,
  toPublicMediaUrlList,
} from "@/lib/media-url"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const origin = getRequestPublicOrigin(request)
    const hotel = await prisma.hotel.findFirst({
      where: {
        id,
        isActive: true,
        isDeleted: false,
        hotelSeller: activeHotelSellerWhere(),
      },
      include: {
        hotelSeller: {
          select: { logo: true, banner: true, mainPhoto: true },
        },
        rooms: {
          where: { isActive: true, isDeleted: false },
          orderBy: { price: "asc" }
        },
        sellerAds: true,
        reviews: {
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              }
            }
          }
        }
      }
    })

    if (!hotel) {
      return NextResponse.json({ success: false, error: "Hotel not found" }, { status: 404 })
    }

    const reviewCount = hotel.reviews.length
    const totalRating = hotel.reviews.reduce((acc, r) => acc + r.rating, 0)
    const averageRating = reviewCount > 0 ? parseFloat((totalRating / reviewCount).toFixed(1)) : 0

    const breakdown: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }
    hotel.reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) {
        breakdown[String(r.rating)] = (breakdown[String(r.rating)] || 0) + 1
      }
    })

    // Remove raw reviews relation structure and format properly
    const { reviews, rooms, sellerAds, ...restHotel } = hotel
    const media = normalizeHotelMedia(hotel, origin)
    const hotelData = {
      ...restHotel,
      hotelSeller: normalizeHotelSellerMedia(hotel.hotelSeller, origin),
      images: media.images,
      banner: media.banner,
      logo: media.logo,
      image_url: media.coverImage,
      coverImage: media.coverImage,
      rooms: rooms.map((room) => ({
        ...room,
        images: toPublicMediaUrlList(room.images, origin),
      })),
      sellerAds: (sellerAds || []).map((ad) => ({
        ...ad,
        creativeUrl: toPublicMediaUrl(ad.creativeUrl, origin),
        mobileCreativeUrl: toPublicMediaUrl(ad.mobileCreativeUrl, origin),
      })),
      starRating: (hotel as any).starRating ?? 0,
      averageRating,
      totalReviews: reviewCount,
      reviewCount,
      reviewsCount: reviewCount,
      breakdown,
      reviews: reviews.map(r => ({
        id: r.id,
        userId: r.userId,
        userName: r.user?.name || "Customer",
        userAvatar: toPublicMediaUrl((r.user as any)?.image || null, origin),
        rating: r.rating,
        comment: r.comment,
        images: toPublicMediaUrlList((r as any).images, origin),
        createdAt: r.createdAt.toISOString()
      }))
    }

    return NextResponse.json({ success: true, data: hotelData })
  } catch (error) {
    console.error("Error fetching mobile hotel details:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
