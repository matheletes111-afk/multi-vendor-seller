import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"

export const dynamic = "force-dynamic"

// GET: List restaurant seller's orders
export async function GET(request: NextRequest) {
  const authStatus = getMobileHotelRestaurantSellerAuth(request, UserRole.SELLER_RESTAURANT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.restaurantSeller.findUnique({
      where: { userId },
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

    return NextResponse.json({
      success: true,
      data: formatted
    })
  } catch (error: any) {
    console.error("Mobile list restaurant orders error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
