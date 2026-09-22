import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
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
      const prodImg = Array.isArray(cat.products?.[0]?.images) ? cat.products[0].images[0] : null
      const resolvedImg = cat.image || cat.mobileIcon || prodImg || cat.subcategories?.[0]?.image || null

      return {
        category_id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || "",
        image_url: resolvedImg,
        mobile_icon: cat.mobileIcon || resolvedImg,
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
