import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const order = await prisma.foodOrder.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            phone: true,
            phoneCountryCode: true
          }
        },
        restaurantSeller: {
          include: {
            businessInfo: {
              select: {
                businessName: true,
                landmark: true,
                street: true,
                city: true,
                state: true,
                pocContact: true,
                managerName: true
              }
            },
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
                phoneCountryCode: true
              }
            },
            bankDetails: true
          }
        },
        items: {
          include: {
            foodItem: {
              select: {
                name: true,
                images: true,
                category: true,
                isVeg: true
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    }

    const items = order.items.map(item => {
      let imageUrl: string | null = null
      if (Array.isArray(item.foodItem.images) && item.foodItem.images.length > 0) {
        imageUrl = item.foodItem.images[0] as string
      } else if (item.foodItem.images && typeof item.foodItem.images === 'string') {
        try {
          const parsed = JSON.parse(item.foodItem.images)
          if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0]
        } catch {}
      }
      return {
        id: item.id,
        foodItemId: item.foodItemId,
        foodName: item.foodItem.name,
        category: item.foodItem.category,
        isVeg: item.foodItem.isVeg,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        imageUrl
      }
    })

    const formatted = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      subtotal: order.subtotal > 0 ? order.subtotal : order.totalAmount,
      deliveryFee: (order as any).deliveryFee ?? 0,
      commissionRate: (order as any).commissionRate ?? 10.0,
      commissionAmount: (order as any).commissionAmount ?? 0,
      sellerNetPayout: (order as any).sellerNetPayout ?? 0,
      settlementStatus: (order as any).settlementStatus ?? "PENDING",
      payoutDisbursedAt: (order as any).payoutDisbursedAt ? (order as any).payoutDisbursedAt.toISOString() : null,
      payoutReference: (order as any).payoutReference || null,
      paymentMethod: (order as any).paymentMethod ?? "COD",
      paymentStatus: (order as any).paymentStatus ?? "PENDING",
      afriTxnId: (order as any).afriTxnId || null,
      flotOrderId: (order as any).flotOrderId || null,
      paidAt: (order as any).paidAt ? (order as any).paidAt.toISOString() : null,
      createdAt: order.createdAt.toISOString(),
      deliveryFullName: order.deliveryFullName,
      deliveryPhone: order.deliveryPhone,
      deliveryAddressLine1: order.deliveryAddressLine1,
      deliveryAddressLine2: order.deliveryAddressLine2,
      deliveryCity: order.deliveryCity,
      deliveryState: order.deliveryState,
      deliveryPostalCode: order.deliveryPostalCode,
      deliveryCountry: order.deliveryCountry,
      couponCode: order.couponCode,
      couponDiscount: order.couponDiscount,
      restaurantSellerId: order.restaurantSellerId,
      customer: {
        name: order.customer.name || "Customer",
        email: order.customer.email,
        phone: order.customer.phone ? `${order.customer.phoneCountryCode || ""}${order.customer.phone}` : "N/A"
      },
      seller: {
        restaurantName: order.restaurantSeller.businessInfo?.businessName || order.restaurantSeller.user.name || "Restaurant",
        ownerName: order.restaurantSeller.user.name || "Seller",
        email: order.restaurantSeller.user.email,
        phone: order.restaurantSeller.user.phone ? `${order.restaurantSeller.user.phoneCountryCode || ""}${order.restaurantSeller.user.phone}` : "N/A",
        address: `${order.restaurantSeller.businessInfo?.street || ""}, ${order.restaurantSeller.businessInfo?.city || ""}, ${order.restaurantSeller.businessInfo?.state || ""}`,
        bankDetails: order.restaurantSeller.bankDetails || null,
      },
      items
    }

    return NextResponse.json({
      success: true,
      data: formatted
    })
  } catch (error) {
    console.error("Admin get restaurant order details error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
