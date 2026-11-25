import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRequestPublicOrigin, toFirstPublicMediaUrl, toPublicMediaUrl } from "@/lib/media-url"

export async function GET(request: NextRequest) {
  try {
    const origin = getRequestPublicOrigin(request)
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        mobileIcon: true,
        isFeatured: true,
        products: {
          where: { isActive: true, isDeleted: false },
          select: { images: true },
          take: 1,
        },
        subcategories: {
          where: { isActive: true },
          select: { image: true },
          take: 1,
        },
        _count: {
          select: {
            products: {
              where: { isActive: true, isDeleted: false },
            },
          },
        },
      },
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    })

    const formatted = categories.map((cat) => {
      const prodImg = toFirstPublicMediaUrl(cat.products?.[0]?.images, origin)
      const resolvedImg = toPublicMediaUrl(cat.image || cat.mobileIcon || prodImg || cat.subcategories?.[0]?.image || null, origin)

      return {
        category_id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || "",
        image_url: resolvedImg,
        mobile_icon: toPublicMediaUrl(cat.mobileIcon, origin) || resolvedImg,
        is_featured: cat.isFeatured,
        product_count: cat._count.products,
        deep_link: `/products?category=${encodeURIComponent(cat.slug)}`,
      }
    })

    return NextResponse.json({
      success: true,
      data: formatted,
    })
  } catch (error) {
    console.error("Product categories API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
