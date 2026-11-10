import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user || session.user.role !== "SELLER_RESTAURANT") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const [seller, globalSetting] = await Promise.all([
      prisma.restaurantSeller.findUnique({
        where: { userId: session.user.id },
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
      const bCommissionRate = o.commissionRate ?? commissionRate
      const commissionBase = o.subtotal > 0 ? o.subtotal : o.totalAmount
      const commissionAmount = o.commissionAmount ?? Math.round(commissionBase * (bCommissionRate / 100) * 100) / 100
      const sellerNet = o.sellerNetPayout ?? Math.max(0, Math.round((commissionBase - commissionAmount) * 100) / 100)
      const settlementStatus = o.settlementStatus ?? (o.status === "DELIVERED" ? "YET_TO_PAY" : "ESCROW_HELD")
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        subtotal: o.subtotal,
        deliveryFee: o.deliveryFee,
        couponCode: o.couponCode,
        couponDiscount: o.couponDiscount,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        afriTxnId: o.afriTxnId,
        paidAt: o.paidAt,
        totalAmount: o.totalAmount,
        commissionRate: bCommissionRate,
        commissionAmount,
        sellerNet,
        settlementStatus,
        payoutReference: o.payoutReference,
        payoutDisbursedAt: o.payoutDisbursedAt,
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

    return NextResponse.json({ success: true, commissionRate, data: formatted })
  } catch (error) {
    console.error("Web restaurant seller get orders error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
