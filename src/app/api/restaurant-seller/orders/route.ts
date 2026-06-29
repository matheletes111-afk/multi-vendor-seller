import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "SELLER_RESTAURANT") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId: session.user.id }
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const orders = await prisma.foodOrder.findMany({
      where: { restaurantSellerId: seller.id },
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        items: {
          include: {
            foodItem: {
              select: {
                name: true,
                image: true
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
      deliveryFullName: o.deliveryFullName,
      deliveryPhone: o.deliveryPhone,
      deliveryAddressLine1: o.deliveryAddressLine1,
      deliveryAddressLine2: o.deliveryAddressLine2,
      deliveryCity: o.deliveryCity,
      deliveryState: o.deliveryState,
      deliveryPostalCode: o.deliveryPostalCode,
      deliveryCountry: o.deliveryCountry,
      customerName: o.customer.name || "Customer",
      customerEmail: o.customer.email,
      items: o.items.map(i => ({
        id: i.id,
        foodName: i.foodItem.name,
        foodImage: i.foodItem.image,
        quantity: i.quantity,
        price: i.price,
        subtotal: i.subtotal
      }))
    }))

    return NextResponse.json({ success: true, data: formatted })
  } catch (error) {
    console.error("Web restaurant seller get orders error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
