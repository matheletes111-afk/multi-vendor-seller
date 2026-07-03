import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET: Fetch active food/restaurant banners for mobile
export async function GET(request: NextRequest) {
  try {
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
        categoryId: true,
        subcategoryId: true,
        serviceCategoryId: true,
        targetType: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      data: banners
    })
  } catch (error) {
    console.error("Mobile foods banners GET error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
