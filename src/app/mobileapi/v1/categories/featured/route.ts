import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vertical = searchParams.get("vertical") || searchParams.get("type") // "product" | "service" | "hotel" | "food" | "all"

    // 1. Featured Product Categories
    const productCategories = await prisma.category.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
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
            products: { where: { isActive: true, isDeleted: false } },
          },
        },
      },
      take: 6,
      orderBy: { name: "asc" },
    })

    const formattedProductCats = productCategories.map((c) => ({
      category_id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      image_url: c.mobileIcon || c.image || null,
      vertical: "product",
      is_featured: true,
      item_count: c._count.products,
      deep_link: `/products?category=${encodeURIComponent(c.slug)}`,
    }))

    // If only product vertical requested, return product categories directly
    if (vertical === "product") {
      return NextResponse.json({
        success: true,
        data: formattedProductCats,
      })
    }

    // 2. Service Categories (Featured)
    const serviceCategories = await prisma.serviceCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        mobileIcon: true,
        _count: { select: { services: { where: { isActive: true, isDeleted: false } } } },
      },
      take: 4,
      orderBy: { name: "asc" },
    })

    const formattedServiceCats = serviceCategories.map((sc) => ({
      category_id: sc.id,
      name: sc.name,
      slug: sc.slug,
      description: "",
      image_url: sc.mobileIcon || sc.image || null,
      vertical: "service",
      is_featured: true,
      item_count: sc._count.services,
      deep_link: `/services?category=${encodeURIComponent(sc.slug)}`,
    }))

    if (vertical === "service") {
      return NextResponse.json({
        success: true,
        data: formattedServiceCats,
      })
    }

    // 3. Hotel Featured Cities
    const defaultHotelCities = [
      {
        category_id: "city_dubai",
        name: "Dubai Stays",
        slug: "dubai",
        description: "Luxury resorts & downtown stays",
        image_url: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
        vertical: "hotel",
        is_featured: true,
        item_count: 12,
        deep_link: "/hotels?city=Dubai",
      },
      {
        category_id: "city_abudhabi",
        name: "Abu Dhabi Stays",
        slug: "abu-dhabi",
        description: "Beachfront & island resorts",
        image_url: "https://images.unsplash.com/photo-1546412414-8035e1776c9a?auto=format&fit=crop&w=600&q=80",
        vertical: "hotel",
        is_featured: true,
        item_count: 8,
        deep_link: "/hotels?city=Abu%20Dhabi",
      },
    ]

    if (vertical === "hotel") {
      return NextResponse.json({
        success: true,
        data: defaultHotelCities,
      })
    }

    // 4. Food Featured Categories
    const defaultFoodCats = [
      {
        category_id: "fc_burgers",
        name: "Burgers & Combos",
        slug: "burgers",
        description: "Smoky grilled burgers & fries",
        image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80",
        vertical: "food",
        is_featured: true,
        item_count: 15,
        deep_link: "/food?category=Burgers",
      },
      {
        category_id: "fc_pizza",
        name: "Woodfired Pizza",
        slug: "pizza",
        description: "Authentic Italian pizzas",
        image_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80",
        vertical: "food",
        is_featured: true,
        item_count: 12,
        deep_link: "/food?category=Pizza",
      },
    ]

    if (vertical === "food") {
      return NextResponse.json({
        success: true,
        data: defaultFoodCats,
      })
    }

    // Default "all": Return combined featured categories grid
    const combinedFeatured = [
      ...formattedProductCats,
      ...formattedServiceCats,
      ...defaultHotelCities,
      ...defaultFoodCats,
    ]

    return NextResponse.json({
      success: true,
      data: combinedFeatured,
    })
  } catch (error) {
    console.error("Featured categories API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
