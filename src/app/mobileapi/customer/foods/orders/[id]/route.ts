import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"

export const dynamic = "force-dynamic"

// GET: Get details of a food order for mobile customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authStatus = await getMobileCustomerAuth(request)
    if (!authStatus.ok) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const userId = authStatus.userId
    const { id } = await params
    const order = await prisma.foodOrder.findFirst({
      where: { id, customerId: userId },
      include: {
        items: {
          include: {
            foodItem: {
              select: {
                id: true,
                name: true,
                images: true,
              }
            }
          }
        },
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

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    }

    // Customer payload: all payment & price breakup data included; commission strictly hidden
    const formatted = {
      id: order.id,
      orderNumber: order.orderNumber,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      couponCode: order.couponCode,
      couponDiscount: order.couponDiscount,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentMethod: order.paymentMethod ?? "COD",
      paymentStatus: order.paymentStatus,
      afriTxnId: order.afriTxnId,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      deliveryFullName: order.deliveryFullName,
      deliveryPhone: order.deliveryPhone,
      deliveryAddressLine1: order.deliveryAddressLine1,
      deliveryAddressLine2: order.deliveryAddressLine2,
      deliveryCity: order.deliveryCity,
      deliveryState: order.deliveryState,
      deliveryPostalCode: order.deliveryPostalCode,
      deliveryCountry: order.deliveryCountry,
      restaurantName: order.restaurantSeller.businessInfo?.businessName || order.restaurantSeller.user.name || "Restaurant",
      items: order.items.map(i => {
        let imageUrl: string | null = null
        if (Array.isArray(i.foodItem.images) && i.foodItem.images.length > 0) {
          imageUrl = i.foodItem.images[0] as string
        } else if (i.foodItem.images && typeof i.foodItem.images === "string") {
          try {
            const parsed = JSON.parse(i.foodItem.images)
            if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0]
          } catch {}
        }
        return {
          id: i.id,
          foodItemId: i.foodItemId,
          foodName: i.foodItem.name,
          foodImage: imageUrl,
          quantity: i.quantity,
          price: i.price,
          subtotal: i.subtotal,
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: formatted
    })
  } catch (error: any) {
    console.error("Mobile customer food order details error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
