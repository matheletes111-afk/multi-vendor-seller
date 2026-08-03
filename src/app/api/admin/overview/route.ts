import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [
      totalSellers,
      totalCustomers,
      totalProducts,
      totalServices,
      totalOrders,
      adAgg,
      subscriptionPlans,
      pendingSellers,
      totalHotels,
      totalHotelSellers,
      totalRestaurantSellers,
      pendingHotelSellers,
      pendingRestaurantSellers,
    ] = await Promise.all([
      prisma.seller.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.service.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.sellerAd.aggregate({
        _sum: { spentAmount: true }
      }),
      prisma.plan.findMany({
        where: { price: { gt: 0 } },
        include: {
          _count: {
            select: {
              subscriptions: true,
              hotelSubscriptions: true,
              restaurantSubscriptions: true,
            }
          }
        }
      }),
      prisma.seller.count({ where: { isApproved: false } }),
      prisma.hotel.count({ where: { isDeleted: false } }),
      prisma.hotelSeller.count(),
      prisma.restaurantSeller.count(),
      prisma.hotelSeller.count({ where: { isApproved: false } }),
      prisma.restaurantSeller.count({ where: { isApproved: false } }),
    ])

    const adRevenue = Number(adAgg._sum.spentAmount ?? 0)
    
    // Fetch coupon usages for subscriptions to deduct discounts from gross subscription revenue
    const subscriptionUsages = await prisma.couponUsage.findMany({
      where: { subscriptionId: { not: null } },
      include: { coupon: true }
    })

    // Map subscription IDs to their plan price to accurately calculate percentage discounts
    const subIds = subscriptionUsages.map(u => u.subscriptionId!).filter(Boolean)
    const [prodSubs, hotelSubs, restSubs] = await Promise.all([
      subIds.length > 0 ? prisma.subscription.findMany({ where: { id: { in: subIds } }, select: { id: true, plan: { select: { price: true } } } }) : [],
      subIds.length > 0 ? prisma.hotelSubscription.findMany({ where: { id: { in: subIds } }, select: { id: true, plan: { select: { price: true } } } }) : [],
      subIds.length > 0 ? prisma.restaurantSubscription.findMany({ where: { id: { in: subIds } }, select: { id: true, plan: { select: { price: true } } } }) : [],
    ])

    const planPriceMap: Record<string, number> = {}
    prodSubs.forEach(s => { planPriceMap[s.id] = s.plan.price })
    hotelSubs.forEach(s => { planPriceMap[s.id] = s.plan.price })
    restSubs.forEach(s => { planPriceMap[s.id] = s.plan.price })
    
    const grossSubscriptionRevenue = subscriptionPlans.reduce((sum, plan) => {
      const counts = plan._count as any
      const totalSubs = (counts.subscriptions ?? 0) + (counts.hotelSubscriptions ?? 0) + (counts.restaurantSubscriptions ?? 0)
      return sum + (plan.price * totalSubs)
    }, 0)

    const totalSubDiscounts = subscriptionUsages.reduce((sum, usage) => {
      if (!usage.coupon) return sum
      const basePrice = planPriceMap[usage.subscriptionId!] || 0
      if (usage.coupon.discountType === "PERCENTAGE") {
        return sum + ((basePrice * usage.coupon.discountValue) / 100)
      } else {
        return sum + Math.min(usage.coupon.discountValue, basePrice)
      }
    }, 0)

    const subscriptionRevenue = Math.max(0, grossSubscriptionRevenue - totalSubDiscounts)
    const commissionRevenue = 0 // Commission is handled separately for now

    // Total platform revenue is Subscription + Ad revenue
    const totalPlatformRevenue = subscriptionRevenue + adRevenue

    return NextResponse.json({
      totalSellers,
      totalCustomers,
      totalProducts,
      totalServices,
      totalOrders,
      totalRevenue: totalPlatformRevenue,
      subscriptionRevenue,
      adRevenue,
      commissionRevenue,
      pendingSellers,
      totalHotels,
      totalHotelSellers,
      totalRestaurantSellers,
      pendingHotelSellers,
      pendingRestaurantSellers,
    })
  } catch (error) {
    console.error("Error fetching admin overview:", error)
    return NextResponse.json(
      { error: "Failed to fetch overview" },
      { status: 500 }
    )
  }
}
