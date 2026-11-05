import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"
import { UserRole } from "@prisma/client"

export const dynamic = "force-dynamic"

const DEFAULT_FOOD_CATEGORIES = [
  "Starters",
  "Mains",
  "Burgers",
  "Pizza",
  "Salads",
  "Sandwiches",
  "Shawarma",
  "Sides",
  "Desserts",
  "Beverages",
  "Breakfast",
  "Platters",
  "Grill & BBQ",
  "Seafood",
  "Rice & Noodles",
  "Vegetarian",
  "Fast Food",
  "Snacks",
]

function extractCleanCategories(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.flatMap(extractCleanCategories)
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return []
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed)
        return extractCleanCategories(parsed)
      } catch {
        return [trimmed]
      }
    }
    return [trimmed]
  }
  return []
}

// GET: Retrieve all active unique food categories for mobile
export async function GET(request: NextRequest) {
  try {
    const categorySet = new Set<string>()
    const canonicalMap = new Map<string, string>()

    const addCategory = (name: string) => {
      const clean = name.trim()
      if (!clean) return
      const lower = clean.toLowerCase()
      if (!canonicalMap.has(lower)) {
        canonicalMap.set(lower, clean)
        categorySet.add(clean)
      }
    }

    // Check if called by a restaurant seller
    const { searchParams } = new URL(request.url)
    const qSellerId = searchParams.get("sellerId") || searchParams.get("restaurantSellerId")
    const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)

    if (authStatus.ok || qSellerId) {
      const seller = await prisma.restaurantSeller.findFirst({
        where: authStatus.ok ? { userId: authStatus.userId } : { id: qSellerId! },
        select: { id: true, primaryCuisine: true },
      })

      if (seller) {
        extractCleanCategories(seller.primaryCuisine).forEach(addCategory)
        const sellerFoods = await prisma.foodItem.findMany({
          where: { restaurantSellerId: seller.id, isDeleted: false },
          select: { category: true },
        })
        sellerFoods.flatMap((f) => extractCleanCategories(f.category)).forEach(addCategory)
      }
    }

    const allActiveCategories = await prisma.foodItem.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        restaurantSeller: {
          isApproved: true,
          isSuspended: false,
        },
      },
      select: {
        category: true,
      },
      take: 200,
    })

    allActiveCategories.flatMap((c) => extractCleanCategories(c.category)).forEach(addCategory)
    DEFAULT_FOOD_CATEGORIES.forEach(addCategory)

    const uniqueCategories = Array.from(categorySet)
    const items = uniqueCategories.map((c) => ({ id: c, name: c }))

    return NextResponse.json({
      success: true,
      data: uniqueCategories,
      categories: uniqueCategories,
      items,
    })
  } catch (error) {
    console.error("Mobile foods categories GET error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
