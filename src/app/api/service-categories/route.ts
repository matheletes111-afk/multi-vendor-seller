import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** GET active service categories with service counts. Public. */
export async function GET() {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        mobileIcon: true,
        isActive: true,
        _count: {
          select: {
            services: {
              where: {
                isActive: true,
                isDeleted: false,
                seller: {
                  isApproved: true,
                  isSuspended: false,
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    })

    const formatted = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      image: cat.image,
      mobileIcon: cat.mobileIcon,
      isActive: cat.isActive,
      serviceCount: cat._count.services,
    }))

    return NextResponse.json({ categories: formatted })
  } catch (error) {
    console.error("Error fetching service categories:", error)
    return NextResponse.json(
      { error: "Failed to fetch service categories" },
      { status: 500 }
    )
  }
}
