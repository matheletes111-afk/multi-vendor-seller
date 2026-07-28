import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const foodItems = await prisma.foodItem.findMany({
      where: { isActive: true, isDeleted: false },
      select: {
        category: true,
        images: true,
      },
    })

    const foodCategoryMap: Record<string, { name: string; count: number; image_url: string | null }> = {}

    foodItems.forEach((fi) => {
      if (!fi.category || fi.category.trim().length === 0) return
      const catName = fi.category.trim()
      if (!foodCategoryMap[catName]) {
        let imageUrl: string | null = null
        if (Array.isArray(fi.images) && fi.images.length > 0) {
          imageUrl = String(fi.images[0])
        }
        foodCategoryMap[catName] = {
          name: catName,
          count: 1,
          image_url: imageUrl,
        }
      } else {
        foodCategoryMap[catName].count += 1
      }
    })

    const categories = Object.values(foodCategoryMap).map((fc, index) => ({
      category_id: `food_cat_${index}`,
      name: fc.name,
      image_url: fc.image_url || "/icons/food.png",
      item_count: fc.count,
      deep_link: `/food?category=${encodeURIComponent(fc.name)}`,
    }))

    // Provide default fallback categories if DB has no food items yet
    if (categories.length === 0) {
      const defaultCategories = [
        { category_id: "fc_burgers", name: "Burgers", image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80", item_count: 15, deep_link: "/food?category=Burgers" },
        { category_id: "fc_pizza", name: "Pizza", image_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80", item_count: 12, deep_link: "/food?category=Pizza" },
        { category_id: "fc_biryani", name: "Biryani & Indian", image_url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80", item_count: 20, deep_link: "/food?category=Indian" },
        { category_id: "fc_desserts", name: "Desserts", image_url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80", item_count: 8, deep_link: "/food?category=Desserts" },
      ]
      return NextResponse.json({
        success: true,
        data: defaultCategories,
      })
    }

    return NextResponse.json({
      success: true,
      data: categories,
    })
  } catch (error) {
    console.error("Food categories API error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
