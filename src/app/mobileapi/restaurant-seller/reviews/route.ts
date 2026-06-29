import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"

export const dynamic = "force-dynamic"

// GET: List restaurant seller's reviews
export async function GET(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const reviews = await prisma.foodReview.findMany({
      where: {
        foodItem: {
          restaurantSellerId: seller.id
        }
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        foodItem: {
          select: {
            id: true,
            name: true,
            images: true,
            category: true
          }
        }
      }
    })

    const formatted = reviews.map(r => {
      let imageUrl: string | null = null
      if (Array.isArray(r.foodItem.images) && r.foodItem.images.length > 0) {
        imageUrl = r.foodItem.images[0] as string
      } else if (r.foodItem.images && typeof r.foodItem.images === 'string') {
        try {
          const parsed = JSON.parse(r.foodItem.images)
          if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0]
        } catch {}
      }
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        customerName: r.user.name || "Customer",
        customerEmail: r.user.email,
        foodItem: {
          id: r.foodItem.id,
          name: r.foodItem.name,
          image: imageUrl,
          category: r.foodItem.category
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: formatted
    })
  } catch (error: any) {
    console.error("Mobile list restaurant reviews error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
