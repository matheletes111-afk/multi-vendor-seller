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
    const [seller, globalSetting] = await Promise.all([
      prisma.restaurantSeller.findUnique({
        where: { userId },
        select: { id: true, commissionRate: true }
      }),
      (prisma as any).globalSetting.findFirst({
        select: { baseCommission: true, restaurantBaseCommission: true }
      }) as Promise<{ baseCommission?: number; restaurantBaseCommission?: number } | null>
    ])

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const commissionRate =
      seller.commissionRate ??
      globalSetting?.restaurantBaseCommission ??
      globalSetting?.baseCommission ??
      10.0

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
                images: true
              }
            }
          }
        }
      }
    })

    const formatted = orders.map(o => {
      const commissionAmount = Math.round(o.totalAmount * (commissionRate / 100) * 100) / 100
      const sellerNet = Math.max(0, Math.round((o.totalAmount - commissionAmount) * 100) / 100)
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        totalAmount: o.totalAmount,
        commissionRate,
        commissionAmount,
        sellerNet,
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
        items: o.items.map(i => {
          let imageUrl: string | null = null
          if (Array.isArray(i.foodItem.images) && i.foodItem.images.length > 0) {
            imageUrl = i.foodItem.images[0] as string
          } else if (i.foodItem.images && typeof i.foodItem.images === 'string') {
            try {
              const parsed = JSON.parse(i.foodItem.images)
              if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0]
            } catch {}
          }
          return {
            id: i.id,
            foodName: i.foodItem.name,
            foodImage: imageUrl,
            quantity: i.quantity,
            price: i.price,
            subtotal: i.subtotal
          }
        })
      }
    })

    return NextResponse.json({
      success: true,
      commissionRate,
      data: formatted
    })
  } catch (error: any) {
    console.error("Mobile list restaurant orders error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
