import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const placement = searchParams.get("placement") || "home_hero"
    const targetType = searchParams.get("type") // "product" | "service" | "hotel" | null

    const whereClause: { isActive: boolean; targetType?: string } = {
      isActive: true,
    }

    if (targetType && targetType.trim().length > 0) {
      whereClause.targetType = targetType.trim().toLowerCase()
    }

    const dbBanners = await prisma.banner.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    })

    const formattedBanners = dbBanners.map((b) => {
      let targetId = null
      if (b.categoryId) targetId = b.categoryId
      else if (b.subcategoryId) targetId = b.subcategoryId
      else if (b.serviceCategoryId) targetId = b.serviceCategoryId

      return {
        banner_id: b.id,
        heading: b.bannerHeading,
        description: b.bannerDescription || "",
        image_url: b.bannerImage,
        target_type: b.targetType || "product",
        target_id: targetId,
        placement: placement,
        cta_text: "Shop Now",
      }
    })

    if (formattedBanners.length > 0) {
      return NextResponse.json({
        success: true,
        data: formattedBanners,
      })
    }

    // Default fallback banners matching requested placement & target type
    const fallbackBanners = [
      {
        banner_id: "banner_hero_1",
        heading: "Exclusive Fashion Sale",
        description: "Get Up To 50% Off on Top Brands",
        image_url: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=80",
        target_type: "product",
        target_id: "fashion",
        placement: placement,
        cta_text: "Discover Now",
      },
      {
        banner_id: "banner_hero_2",
        heading: "Luxury Staycation Deals",
        description: "Book Resorts & Hotels in Dubai",
        image_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80",
        target_type: "hotel",
        target_id: "dubai",
        placement: placement,
        cta_text: "Book Stay",
      },
    ]

    const filteredFallbacks = targetType
      ? fallbackBanners.filter((fb) => fb.target_type === targetType.toLowerCase())
      : fallbackBanners

    return NextResponse.json({
      success: true,
      data: filteredFallbacks.length > 0 ? filteredFallbacks : fallbackBanners,
    })
  } catch (error) {
    console.error("Banners API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
