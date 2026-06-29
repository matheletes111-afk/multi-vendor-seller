import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "SELLER_RESTAURANT") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId: session.user.id }
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

    return NextResponse.json({ success: true, data: formatted })
  } catch (error) {
    console.error("Web restaurant seller get reviews error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
