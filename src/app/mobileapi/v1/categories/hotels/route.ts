import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const hotels = await prisma.hotel.findMany({
      where: { isActive: true, isDeleted: false },
      select: {
        city: true,
        images: true,
        banner: true,
      },
    })

    const cityMap: Record<string, { city: string; hotel_count: number; image_url: string | null }> = {}

    hotels.forEach((h) => {
      if (!h.city || h.city.trim().length === 0) return
      const cityName = h.city.trim()
      if (!cityMap[cityName]) {
        let imageUrl: string | null = h.banner || null
        if (!imageUrl && Array.isArray(h.images) && h.images.length > 0) {
          imageUrl = String(h.images[0])
        }
        cityMap[cityName] = {
          city: cityName,
          hotel_count: 1,
          image_url: imageUrl,
        }
      } else {
        cityMap[cityName].hotel_count += 1
      }
    })

    const cityCategories = Object.values(cityMap).map((c, index) => ({
      category_id: `city_cat_${index}`,
      name: `${c.city} Stays`,
      city: c.city,
      image_url: c.image_url || "/icons/hotel.png",
      hotel_count: c.hotel_count,
      deep_link: `/hotels?city=${encodeURIComponent(c.city)}`,
    }))

    // Provide default Dubai & Abu Dhabi fallbacks if DB has no cities registered yet
    if (cityCategories.length === 0) {
      const defaultCities = [
        { category_id: "city_dubai", name: "Dubai Stays", city: "Dubai", image_url: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80", hotel_count: 12, deep_link: "/hotels?city=Dubai" },
        { category_id: "city_abudhabi", name: "Abu Dhabi Stays", city: "Abu Dhabi", image_url: "https://images.unsplash.com/photo-1546412414-8035e1776c9a?auto=format&fit=crop&w=600&q=80", hotel_count: 8, deep_link: "/hotels?city=Abu%20Dhabi" },
        { category_id: "city_sharjah", name: "Sharjah Stays", city: "Sharjah", image_url: "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=600&q=80", hotel_count: 5, deep_link: "/hotels?city=Sharjah" },
      ]
      return NextResponse.json({
        success: true,
        data: defaultCities,
      })
    }

    return NextResponse.json({
      success: true,
      data: cityCategories,
    })
  } catch (error) {
    console.error("Hotel categories API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
