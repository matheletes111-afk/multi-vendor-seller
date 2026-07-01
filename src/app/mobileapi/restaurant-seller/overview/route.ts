import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileHotelRestaurantSellerAuth } from "../../_helpers/hotel-restaurant-seller-auth"
import { getValidRestaurantSubscription } from "@/lib/subscriptions"

export const dynamic = 'force-dynamic'

/**
 * GET /mobileapi/restaurant-seller/overview
 * Get restaurant seller dashboard metrics.
 */
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
        select: { id: true, commissionRate: true, estimateRestaurantCount: true },
      }),
      prisma.globalSetting.findFirst(),
    ])

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 })
    }

    const [activeFoodsCount, totalOrders, subscription, totalAdClicks] = await Promise.all([
      prisma.foodItem.count({
        where: { restaurantSellerId: seller.id, isDeleted: false },
      }),
      prisma.foodOrder.count({
        where: { restaurantSellerId: seller.id },
      }),
      getValidRestaurantSubscription(seller.id),
      prisma.adClick ? prisma.adClick.count({
        where: { ad: { restaurantSellerId: seller.id } },
      }) : Promise.resolve(0),
    ])

    // Fetch gross revenue from orders
    const revenueAggregate = await prisma.foodOrder.aggregate({
      where: {
        restaurantSellerId: seller.id,
        status: { notIn: ["CANCELLED"] }
      },
      _sum: {
        totalAmount: true
      }
    })

    const totalRevenue = revenueAggregate._sum.totalAmount || 0.0
    const commissionPct = seller.commissionRate ?? globalSetting?.baseCommission ?? 10.0
    const netBalance = totalRevenue * (1 - commissionPct / 100)

    return NextResponse.json({
      success: true,
      data: {
        subscription,
        commissionRate: commissionPct,
        isGlobalRate: seller.commissionRate === null || seller.commissionRate === undefined,
        totalFoods: activeFoodsCount,
        totalOrders,
        totalRevenue,
        totalRevenueFormatted: `Nle ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        netBalance,
        netBalanceFormatted: `Nle ${netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalAdClicks,
        estimateFoodCount: seller.estimateRestaurantCount, // matches onboarding estimate fields
      }
    })
  } catch (error) {
    console.error("Error in mobile restaurant seller overview API:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}
