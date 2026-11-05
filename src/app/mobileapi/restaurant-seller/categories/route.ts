import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"

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

/**
 * GET /mobileapi/restaurant-seller/categories
 * Returns categories for restaurant seller food upload / dropdowns.
 */
export async function GET(request: NextRequest) {
  try {
    let seller: { id: string; primaryCuisine: any } | null = null

    // 1. Try mobile bearer auth
    const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
    if (authStatus.ok) {
      seller = await prisma.restaurantSeller.findUnique({
        where: { userId: authStatus.userId },
        select: { id: true, primaryCuisine: true },
      })
    }

    // 2. Fallback to query param sellerId / restaurantSellerId if provided
    if (!seller) {
      const { searchParams } = new URL(request.url)
      const qSellerId = searchParams.get("sellerId") || searchParams.get("restaurantSellerId")
      if (qSellerId) {
        seller = await prisma.restaurantSeller.findUnique({
          where: { id: qSellerId },
          select: { id: true, primaryCuisine: true },
        })
      }
    }

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

    let cuisines: string[] = []

    if (seller) {
      // Add seller's primary cuisines
      cuisines = extractCleanCategories(seller.primaryCuisine)
      cuisines.forEach(addCategory)

      // Add seller's existing food item categories
      const sellerFoods = await prisma.foodItem.findMany({
        where: {
          restaurantSellerId: seller.id,
          isDeleted: false,
        },
        select: { category: true },
      })
      sellerFoods.flatMap((f) => extractCleanCategories(f.category)).forEach(addCategory)
    }

    // Add active categories across all approved restaurants as well
    const allActiveCategories = await prisma.foodItem.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        restaurantSeller: {
          isApproved: true,
          isSuspended: false,
        },
      },
      select: { category: true },
      take: 200,
    })
    allActiveCategories.flatMap((f) => extractCleanCategories(f.category)).forEach(addCategory)

    // Add standard defaults
    DEFAULT_FOOD_CATEGORIES.forEach(addCategory)

    const categoriesList = Array.from(categorySet)
    const formattedData = categoriesList.map((cat) => ({
      id: cat,
      name: cat,
    }))

    return NextResponse.json({
      success: true,
      data: formattedData,
      categories: categoriesList,
      cuisines,
    })
  } catch (error: any) {
    console.error("Mobile restaurant seller categories GET error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

