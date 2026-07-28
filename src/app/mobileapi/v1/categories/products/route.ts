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

    const formatted = categories.map((cat) => ({
      category_id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || "",
      image_url: cat.mobileIcon || cat.image || null,
      is_featured: cat.isFeatured,
      product_count: cat._count.products,
      deep_link: `/products?category=${encodeURIComponent(cat.slug)}`,
    }))

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
