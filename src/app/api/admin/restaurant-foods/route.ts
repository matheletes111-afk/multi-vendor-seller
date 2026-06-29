import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const restaurantSellerId = searchParams.get("restaurantSellerId")

    const where: any = {
      isDeleted: false
    }

    if (restaurantSellerId) {
      where.restaurantSellerId = restaurantSellerId
    }

    const [foods, totalCount] = await Promise.all([
      prisma.foodItem.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          restaurantSeller: {
            include: {
              businessInfo: {
                select: {
                  businessName: true
                }
              },
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }),
      prisma.foodItem.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / perPage) || 1

    const formattedFoods = foods.map(f => {
      let firstImage: string | null = null
      if (Array.isArray(f.images) && f.images.length > 0) {
        firstImage = f.images[0] as string
      } else if (f.images && typeof f.images === 'string') {
        try {
          const parsed = JSON.parse(f.images)
          if (Array.isArray(parsed) && parsed.length > 0) {
            firstImage = parsed[0]
          }
        } catch {}
      }
      return {
        id: f.id,
        name: f.name,
        description: f.description,
        price: f.price,
        image: firstImage,
        images: f.images,
        category: f.category,
        isVeg: f.isVeg,
        isActive: f.isActive,
        restaurantSellerId: f.restaurantSellerId,
        restaurantName: f.restaurantSeller.businessInfo?.businessName || f.restaurantSeller.user.name || "Restaurant"
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        foods: formattedFoods,
        pagination: {
          totalCount,
          totalPages,
          page,
          perPage
        }
      }
    })
  } catch (error) {
    console.error("Admin list foods error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing food item ID" }, { status: 400 })
    }

    await prisma.foodItem.update({
      where: { id },
      data: { isDeleted: true }
    })

    return NextResponse.json({ success: true, message: "Food item deleted successfully" })
  } catch (error) {
    console.error("Admin delete food item error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
