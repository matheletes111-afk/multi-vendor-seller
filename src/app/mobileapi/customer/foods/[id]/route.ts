import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { activeRestaurantSellerWhere } from "@/lib/subscriptions"
import { getRequestPublicOrigin, toPublicMediaUrl, toPublicMediaUrlList } from "@/lib/media-url"

export const dynamic = "force-dynamic"

// GET: Get food details and customer reviews (Guest Accessible)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const origin = getRequestPublicOrigin(request)

    const food = await prisma.foodItem.findFirst({
      where: {
        id,
        isDeleted: false,
        isActive: true,
        restaurantSeller: activeRestaurantSellerWhere()
      },
      include: {
        sellerAds: true,
        restaurantSeller: {
          include: {
            businessInfo: {
              select: {
                businessName: true,
                street: true,
                city: true,
                state: true,
              }
            },
            user: {
              select: {
                name: true,
                image: true,
              }
            }
          }
        },
        reviews: {
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        }
      }
    })

    if (!food) {
      return NextResponse.json({ success: false, error: "Food item not found" }, { status: 404 })
    }

    const reviewCount = food.reviews.length
    const totalRating = food.reviews.reduce((acc, r) => acc + r.rating, 0)
    const averageRating = reviewCount > 0 ? parseFloat((totalRating / reviewCount).toFixed(1)) : 0.0

    const breakdown: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }
    food.reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) {
        breakdown[String(r.rating)] = (breakdown[String(r.rating)] || 0) + 1
      }
    })

    const { reviews, sellerAds, restaurantSeller, ...restFood } = food
    const extractedImages = toPublicMediaUrlList(food.images, origin)
    const firstImage = extractedImages[0] ?? null
    const sellingPrice = Math.max(0, food.price - (food.discount || 0))
    const restaurantLogo = toPublicMediaUrl(restaurantSeller.logo || restaurantSeller.user?.image, origin)
    const restaurantBanner = toPublicMediaUrl(restaurantSeller.banner, origin)
    const restaurantMainPhoto = toPublicMediaUrl(restaurantSeller.mainPhoto, origin)
    const restaurantName = restaurantSeller.businessInfo?.businessName || restaurantSeller.user?.name || "Restaurant"

    const foodData = {
      ...restFood,
      restaurantSeller: {
        ...restaurantSeller,
        logo: restaurantLogo,
        banner: restaurantBanner,
        mainPhoto: restaurantMainPhoto,
        user: restaurantSeller.user
          ? {
              ...restaurantSeller.user,
              image: toPublicMediaUrl(restaurantSeller.user.image, origin),
            }
          : restaurantSeller.user,
      },
      restaurantName,
      restaurantLogo,
      restaurant_logo: restaurantLogo,
      restaurantBanner,
      restaurant_banner: restaurantBanner,
      restaurantMainPhoto,
      restaurant_main_photo: restaurantMainPhoto,
      discount: food.discount || 0,
      sellingPrice,
      selling_price: sellingPrice,
      images: extractedImages,
      image: firstImage,
      image_url: firstImage,
      sellerAds: (sellerAds || []).map((ad) => ({
        ...ad,
        creativeUrl: toPublicMediaUrl(ad.creativeUrl, origin),
        mobileCreativeUrl: toPublicMediaUrl(ad.mobileCreativeUrl, origin),
      })),
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

    return NextResponse.json({
      success: true,
      data: foodData
    })
  } catch (error: any) {
    console.error("Mobile public food item details error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
