import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "4", 10)))

    const categories = await prisma.serviceCategory.findMany({
      where: { isActive: true },
      take: limit,
      orderBy: { name: "asc" },
      include: {
        services: {
          where: { isActive: true, isDeleted: false },
          select: { basePrice: true, discount: true },
          orderBy: { basePrice: "asc" },
          take: 1,
        },
      },
    })

    const featuredGrid = categories.map((cat, index) => {
      const minService = cat.services[0]
      const startingPrice = minService
        ? Math.max(0, (minService.basePrice || 0) - (minService.discount || 0))
        : 49

      let imageUrl: string | null = cat.mobileIcon || cat.image || null

      const discountTags = ["UP TO 30% OFF", "POPULAR", "EXPRESS SERVICE", "TOP RATED"]
      const discountTag = discountTags[index % discountTags.length]

      return {
        service_id: cat.id,
        name: cat.name,
        slug: cat.slug,
        image_url: imageUrl || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80",
        discount_tag: discountTag,
        starting_price: startingPrice,
        currency: "AED",
        deep_link: `/services?category=${encodeURIComponent(cat.slug)}`,
      }
    })

    // Fallback preview items if DB has no service categories yet
    if (featuredGrid.length === 0) {
      const fallbacks = [
        {
          service_id: "scat_feat_1",
          name: "AC Maintenance & Repair",
          slug: "ac-maintenance",
          image_url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80",
          discount_tag: "UP TO 30% OFF",
          starting_price: 79,
          currency: "AED",
          deep_link: "/services?category=ac-maintenance",
        },
        {
          service_id: "scat_feat_2",
          name: "Deep Home Cleaning",
          slug: "home-cleaning",
          image_url: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80",
          discount_tag: "POPULAR",
          starting_price: 99,
          currency: "AED",
          deep_link: "/services?category=home-cleaning",
        },
        {
          service_id: "scat_feat_3",
          name: "Plumbing & Leak Repairs",
          slug: "plumbing",
          image_url: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=400&q=80",
          discount_tag: "EXPRESS SERVICE",
          starting_price: 49,
          currency: "AED",
          deep_link: "/services?category=plumbing",
        },
        {
          service_id: "scat_feat_4",
          name: "Electrician Services",
          slug: "electrical",
          image_url: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=400&q=80",
          discount_tag: "TOP RATED",
          starting_price: 59,
          currency: "AED",
          deep_link: "/services?category=electrical",
        },
      ]
      return NextResponse.json({
        success: true,
        data: fallbacks,
      })
    }

    return NextResponse.json({
      success: true,
      data: featuredGrid,
    })
  } catch (error) {
    console.error("Featured home services API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
