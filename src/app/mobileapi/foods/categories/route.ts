import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET: Retrieve all active unique food categories for mobile
export async function GET(request: NextRequest) {
  try {
    const allActiveCategories = await prisma.foodItem.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        restaurantSeller: {
          isApproved: true,
          isSuspended: false
        }
      },
      select: {
        category: true
      }
    })

    const uniqueCategories = Array.from(new Set(allActiveCategories.map(c => c.category)))

    return NextResponse.json({
      success: true,
      categories: uniqueCategories
    })
  } catch (error) {
    console.error("Mobile foods categories GET error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
