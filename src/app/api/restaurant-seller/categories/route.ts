import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isRestaurantSeller } from "@/lib/rbac"

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

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isRestaurantSeller(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        primaryCuisine: true,
      },
    })

    if (!seller) {
      return NextResponse.json({ error: "Restaurant seller not found" }, { status: 404 })
    }

    // 1. Seller's primary cuisines
    const cuisines = extractCleanCategories(seller.primaryCuisine)

    // 2. Existing food items categories created by this seller
    const existingFoods = await prisma.foodItem.findMany({
      where: {
        restaurantSellerId: seller.id,
        isDeleted: false,
      },
      select: { category: true },
    })

    const foodItemCategories = existingFoods.flatMap((f) => extractCleanCategories(f.category))

    // 3. Merge: cuisines first, then existing food categories, then standard categories
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

    // Prioritize seller's own choices
    cuisines.forEach(addCategory)
    foodItemCategories.forEach(addCategory)
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
    console.error("Restaurant seller categories GET error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

