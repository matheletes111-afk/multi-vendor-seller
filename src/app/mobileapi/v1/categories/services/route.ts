import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const serviceCategories = await prisma.serviceCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        mobileIcon: true,
        _count: {
          select: {
            services: {
              where: { isActive: true, isDeleted: false },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    })

    const formatted = serviceCategories.map((scat) => ({
      category_id: scat.id,
      name: scat.name,
      slug: scat.slug,
      description: scat.description || "",
      image_url: scat.mobileIcon || scat.image || null,
      service_count: scat._count.services,
      deep_link: `/services?category=${encodeURIComponent(scat.slug)}`,
    }))

    return NextResponse.json({
      success: true,
      data: formatted,
    })
  } catch (error) {
    console.error("Service categories API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
