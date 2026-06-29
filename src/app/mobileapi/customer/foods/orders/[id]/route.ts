import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"

export const dynamic = "force-dynamic"

function getCustomerId(request: NextRequest): string | null {
  const auth = request.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ")) return null
  const token = auth.slice(7).trim()
  const payload = verifyMobileAccessToken(token)
  if (!payload || payload.role !== "CUSTOMER") return null
  return payload.userId
}

// GET: Get details of a food order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getCustomerId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const order = await prisma.foodOrder.findFirst({
      where: { id, customerId: userId },
      include: {
        items: {
          include: {
            foodItem: {
              select: {
                name: true
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

    const formatted = {
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      status: order.status,
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
      items: order.items.map(i => ({
        id: i.id,
        foodItemId: i.foodItemId,
        foodName: i.foodItem.name,
        quantity: i.quantity,
        price: i.price,
        subtotal: i.subtotal
      }))
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
