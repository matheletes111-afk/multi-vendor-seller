import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "CUSTOMER") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const orders = await prisma.foodOrder.findMany({
      where: { customerId: session.user.id },
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
    })

    const formatted = orders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      totalAmount: o.totalAmount,
      status: o.status,
      createdAt: o.createdAt,
      restaurantName: o.restaurantSeller.businessInfo?.businessName || o.restaurantSeller.user.name || "Restaurant"
    }))

    return NextResponse.json({ success: true, data: formatted })
  } catch (error) {
    console.error("Web get customer food orders error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "CUSTOMER") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      restaurantSellerId,
      items, // Array of { foodItemId, quantity }
      deliveryFullName,
      deliveryPhone,
      deliveryAddressLine1,
      deliveryAddressLine2,
      deliveryCity,
      deliveryState,
      deliveryPostalCode,
      deliveryCountry
    } = body

    if (!restaurantSellerId || !items || !Array.isArray(items) || items.length === 0 || !deliveryFullName || !deliveryPhone || !deliveryAddressLine1 || !deliveryCity || !deliveryState || !deliveryPostalCode || !deliveryCountry) {
      return NextResponse.json({ success: false, error: "Missing required order checkout details" }, { status: 400 })
    }

    const seller = await prisma.restaurantSeller.findFirst({
      where: { id: restaurantSellerId, isApproved: true }
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Restaurant seller not found or inactive" }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      let totalAmount = 0
      const orderItemsToCreate = []

      for (const item of items) {
        const food = await tx.foodItem.findFirst({
          where: { id: item.foodItemId, restaurantSellerId, isDeleted: false, isActive: true }
        })
        if (!food) {
          throw new Error(`Food item ${item.foodItemId} not found or inactive`)
        }

        const quantity = parseInt(String(item.quantity))
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error("Quantity must be a positive integer")
        }

        const price = food.price
        const subtotal = price * quantity
        totalAmount += subtotal

        orderItemsToCreate.push({
          foodItemId: food.id,
          quantity,
          price,
          subtotal
        })
      }

      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
      const randomStr = Math.floor(1000 + Math.random() * 9000).toString()
      const orderNumber = `F-${dateStr}-${randomStr}`

      const order = await tx.foodOrder.create({
        data: {
          orderNumber,
          customerId: session.user.id,
          restaurantSellerId,
          totalAmount,
          deliveryFullName,
          deliveryPhone,
          deliveryAddressLine1,
          deliveryAddressLine2,
          deliveryCity,
          deliveryState,
          deliveryPostalCode,
          deliveryCountry,
          status: "PENDING",
          items: {
            create: orderItemsToCreate
          }
        }
      })

      return order
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error: any) {
    console.error("Web place food order error:", error)
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 })
  }
}
