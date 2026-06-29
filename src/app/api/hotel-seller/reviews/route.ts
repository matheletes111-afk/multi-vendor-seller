import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "SELLER_HOTEL") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.hotelSeller.findUnique({
      where: { userId: session.user.id }
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
              name: true,
              email: true
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
      prisma.hotelReview.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / perPage) || 1

    return NextResponse.json({
      success: true,
      data: {
        reviews: reviews.map(r => ({
          id: r.id,
          hotelId: r.hotel.id,
          hotelName: r.hotel.name,
          userName: r.user.name || "Customer",
          userEmail: r.user.email,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt
        })),
        pagination: {
          totalCount,
          totalPages,
          page,
          perPage
        }
      }
    })
  } catch (error) {
    console.error("Web seller hotel reviews error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
