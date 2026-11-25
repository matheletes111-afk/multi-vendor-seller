import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRequestPublicOrigin, toPublicMediaUrl } from "@/lib/media-url"

export const dynamic = "force-dynamic"

// GET: Fetch active food/restaurant banners for mobile
export async function GET(request: NextRequest) {
  try {
    const origin = getRequestPublicOrigin(request)
    const banners = await prisma.banner.findMany({
      where: { 
        isActive: true,
        targetType: "restaurant"
      },
      select: {
        id: true,
        bannerHeading: true,
        bannerDescription: true,
        bannerImage: true,
        mobileBanner: true,
        categoryId: true,
        subcategoryId: true,
        serviceCategoryId: true,
        targetType: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const formattedBanners = banners.map((b) => {
      const bannerImage = toPublicMediaUrl(b.bannerImage, origin) || b.bannerImage
      const mobileBanner = toPublicMediaUrl(b.mobileBanner, origin)
      return {
        ...b,
        bannerImage,
        mobileBanner: mobileBanner || bannerImage,
        mobile_banner: mobileBanner || bannerImage,
      }
    })

    return NextResponse.json({
      success: true,
      data: formattedBanners
    })
  } catch (error) {
    console.error("Mobile foods banners GET error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
