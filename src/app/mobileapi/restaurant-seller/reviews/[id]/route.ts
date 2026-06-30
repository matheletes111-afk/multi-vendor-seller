import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../../_helpers/hotel-restaurant-seller-auth"

export const dynamic = "force-dynamic"

// GET: List detailed customer reviews for a specific food item via mobile api
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: foodItemId } = await params
    if (!foodItemId) {
      return NextResponse.json({ success: false, error: "Food item ID is required" }, { status: 400 })
    }

    const foodItem = await prisma.foodItem.findFirst({
      where: { id: foodItemId, restaurantSellerId: seller.id },
      select: { id: true, name: true, images: true }
    })
    if (!foodItem) {
      return NextResponse.json({ success: false, error: "Food item not found or unauthorized" }, { status: 404 })
    }

    const reviews = await prisma.foodReview.findMany({
      where: { foodItemId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    const reviewCount = reviews.length
    const avgRating = reviewCount > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1)
      : "0.0"

    let imageUrl: string | null = null
    if (Array.isArray(foodItem.images) && foodItem.images.length > 0) {
      imageUrl = foodItem.images[0] as string
    } else if (typeof foodItem.images === 'string') {
      try {
        const parsed = JSON.parse(foodItem.images)
        if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0]
      } catch {}
    }

    const formattedReviews = reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      images: r.images,
      createdAt: r.createdAt.toISOString(),
      customerName: r.user.name || "Customer",
      customerEmail: r.user.email
    }))

    return NextResponse.json({
      success: true,
      data: {
        foodItemId: foodItem.id,
        foodItemName: foodItem.name,
        foodItemImage: imageUrl,
        avgRating,
        reviewCount,
        reviews: formattedReviews
      }
    })
  } catch (error) {
    console.error("Mobile restaurant seller food review details error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
