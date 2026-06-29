import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export const dynamic = "force-dynamic"

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

    const hotelId = searchParams.get("hotelId")

    const where: any = {
      hotel: {
        hotelSellerId: seller.id,
        isDeleted: false
      }
    }

    if (hotelId) {
      where.hotelId = hotelId
    }

    const [reviews, totalCount] = await Promise.all([
      prisma.hotelReview.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              name: true
            }
          },
          hotel: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      prisma.hotelReview.count({ where }),
    ])

    const totalPages = Math.ceil(totalCount / perPage) || 1

    const formattedReviews = reviews.map(r => ({
      id: r.id,
      hotelId: r.hotel.id,
      hotelName: r.hotel.name,
      userName: r.user.name || "Customer",
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt
    }))

    return NextResponse.json({
      success: true,
      data: {
        reviews: formattedReviews,
        pagination: {
          totalCount,
          totalPages,
          page,
          perPage,
        }
      }
    })
  } catch (error: any) {
    console.error("Mobile hotel seller reviews list error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
