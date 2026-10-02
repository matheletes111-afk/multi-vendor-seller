import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin, canAccessModule } from "@/lib/rbac"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user) || !canAccessModule(session.user, "dashboard")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const now = new Date()
    const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    const [
      totalProductSellers,
      totalServiceSellers,
      totalHotelSellers,
      totalRestaurantSellers,
      pendingProductSellers,
      pendingServiceSellers,
      pendingHotelSellers,
      pendingRestaurantSellers,
      totalCustomers,
      totalProducts,
      activeProducts,
      totalServices,
      activeServices,
      totalFoods,
      activeFoods,
      totalHotels,
      activeHotels,
      totalRiders,
      approvedRiders,
      pendingRiders,
      totalOrders,
      totalFoodOrders,
      totalHotelBookings,
      adAgg,
      orderAgg,
      foodOrderAgg,
      hotelBookingAgg,
      prodSubs,
      hotelSubs,
      restSubs,
      recentOrders,
      recentFoodOrders,
      recentHotelBookings,
      recentAds,
      recentSellers,
      recentHotelSellers,
      recentRestaurantSellers,
      recentProducts,
      recentServices,
      recentFoods,
      recentRiders,
    ] = await Promise.all([
      prisma.seller.count({ where: { type: "PRODUCT" } }),
      prisma.seller.count({ where: { type: "SERVICE" } }),
      prisma.hotelSeller.count(),
      prisma.restaurantSeller.count(),
      prisma.seller.count({ where: { type: "PRODUCT", isApproved: false } }),
      prisma.seller.count({ where: { type: "SERVICE", isApproved: false } }),
      prisma.hotelSeller.count({ where: { isApproved: false } }),
      prisma.restaurantSeller.count({ where: { isApproved: false } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.product.count({ where: { isDeleted: false } }),
      prisma.product.count({ where: { isDeleted: false, isActive: true } }),
      prisma.service.count({ where: { isDeleted: false } }),
      prisma.service.count({ where: { isDeleted: false, isActive: true } }),
      prisma.foodItem.count({ where: { isDeleted: false } }),
      prisma.foodItem.count({ where: { isDeleted: false, isActive: true } }),
      prisma.hotel.count({ where: { isDeleted: false } }),
      prisma.hotel.count({ where: { isDeleted: false, isActive: true } }),
      prisma.rider.count(),
      prisma.rider.count({ where: { isApproved: true, isSuspended: false } }),
      prisma.rider.count({ where: { isApproved: false } }),
      prisma.order.count(),
      prisma.foodOrder.count(),
      prisma.hotelBooking.count(),
      prisma.sellerAd.aggregate({ _sum: { spentAmount: true } }),
      prisma.order.aggregate({ _sum: { totalAmount: true } }),
      prisma.foodOrder.aggregate({ _sum: { totalAmount: true } }),
      prisma.hotelBooking.aggregate({ _sum: { totalPrice: true } }),
      prisma.subscription.findMany({ select: { id: true, paidPrice: true, createdAt: true, plan: { select: { price: true } } } }),
      prisma.hotelSubscription.findMany({ select: { id: true, paidPrice: true, createdAt: true, plan: { select: { price: true } } } }),
      prisma.restaurantSubscription.findMany({ select: { id: true, paidPrice: true, createdAt: true, plan: { select: { price: true } } } }),
      prisma.order.findMany({ where: { createdAt: { gte: startMonth } }, select: { totalAmount: true, createdAt: true } }),
      prisma.foodOrder.findMany({ where: { createdAt: { gte: startMonth } }, select: { totalAmount: true, createdAt: true } }),
      prisma.hotelBooking.findMany({ where: { createdAt: { gte: startMonth } }, select: { totalPrice: true, createdAt: true } }),
      prisma.sellerAd.findMany({ where: { createdAt: { gte: startMonth } }, select: { spentAmount: true, createdAt: true } }),
      prisma.seller.findMany({ where: { createdAt: { gte: startMonth } }, select: { type: true, createdAt: true } }),
      prisma.hotelSeller.findMany({ where: { createdAt: { gte: startMonth } }, select: { createdAt: true } }),
      prisma.restaurantSeller.findMany({ where: { createdAt: { gte: startMonth } }, select: { createdAt: true } }),
      prisma.product.findMany({ where: { createdAt: { gte: startMonth }, isDeleted: false }, select: { createdAt: true } }),
      prisma.service.findMany({ where: { createdAt: { gte: startMonth }, isDeleted: false }, select: { createdAt: true } }),
      prisma.foodItem.findMany({ where: { createdAt: { gte: startMonth }, isDeleted: false }, select: { createdAt: true } }),
      prisma.rider.findMany({ where: { createdAt: { gte: startMonth } }, select: { createdAt: true } }),
    ])

    const adRevenue = Number(adAgg._sum.spentAmount ?? 0)

    let subscriptionRevenue = 0
    prodSubs.forEach(s => {
      const p = s.paidPrice !== null && s.paidPrice !== undefined ? s.paidPrice : (s.plan?.price || 0)
      subscriptionRevenue += p
    })
    hotelSubs.forEach(s => {
      const p = s.paidPrice !== null && s.paidPrice !== undefined ? s.paidPrice : (s.plan?.price || 0)
      subscriptionRevenue += p
    })
    restSubs.forEach(s => {
      const p = s.paidPrice !== null && s.paidPrice !== undefined ? s.paidPrice : (s.plan?.price || 0)
      subscriptionRevenue += p
    })

    const totalPlatformRevenue = subscriptionRevenue + adRevenue
    const totalOrderVolume = Number(orderAgg._sum.totalAmount ?? 0)
    const totalFoodOrderVolume = Number(foodOrderAgg._sum.totalAmount ?? 0)
    const totalHotelBookingVolume = Number(hotelBookingAgg._sum.totalPrice ?? 0)
    const grossMerchandiseValue = totalOrderVolume + totalFoodOrderVolume + totalHotelBookingVolume

    const totalAllSellers = totalProductSellers + totalServiceSellers + totalHotelSellers + totalRestaurantSellers
    const totalPendingSellers = pendingProductSellers + pendingServiceSellers + pendingHotelSellers + pendingRestaurantSellers

    // 12-month analytics bucket construction
    const monthlyMap = new Map<string, {
      monthKey: string
      label: string
      shortLabel: string
      year: number
      month: number
      subscriptionRevenue: number
      adRevenue: number
      orderRevenue: number
      foodOrderRevenue: number
      hotelBookingRevenue: number
      totalRevenue: number
      platformRevenue: number
      gmv: number
      ordersCount: number
      foodOrdersCount: number
      hotelBookingsCount: number
      totalTransactions: number
      newProductSellers: number
      newServiceSellers: number
      newHotelSellers: number
      newRestaurantSellers: number
      totalNewSellers: number
      newProducts: number
      newServices: number
      newFoods: number
      newRiders: number
    }>()

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = d.toLocaleString("en-US", { month: "short", year: "numeric" })
      const shortLabel = d.toLocaleString("en-US", { month: "short" })

      monthlyMap.set(monthKey, {
        monthKey,
        label,
        shortLabel,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        subscriptionRevenue: 0,
        adRevenue: 0,
        orderRevenue: 0,
        foodOrderRevenue: 0,
        hotelBookingRevenue: 0,
        totalRevenue: 0,
        platformRevenue: 0,
        gmv: 0,
        ordersCount: 0,
        foodOrdersCount: 0,
        hotelBookingsCount: 0,
        totalTransactions: 0,
        newProductSellers: 0,
        newServiceSellers: 0,
        newHotelSellers: 0,
        newRestaurantSellers: 0,
        totalNewSellers: 0,
        newProducts: 0,
        newServices: 0,
        newFoods: 0,
        newRiders: 0,
      })
    }

    const getMonthKey = (date: Date) => {
      const d = new Date(date)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    }

    const addSubToMonth = (s: { createdAt: Date; paidPrice: number | null; plan?: { price: number } | null }) => {
      const k = getMonthKey(s.createdAt)
      const bucket = monthlyMap.get(k)
      if (bucket) {
        const p = s.paidPrice !== null && s.paidPrice !== undefined ? s.paidPrice : (s.plan?.price || 0)
        bucket.subscriptionRevenue += p
        bucket.platformRevenue += p
        bucket.totalRevenue += p
      }
    }
    prodSubs.forEach(s => s.createdAt >= startMonth && addSubToMonth(s))
    hotelSubs.forEach(s => s.createdAt >= startMonth && addSubToMonth(s))
    restSubs.forEach(s => s.createdAt >= startMonth && addSubToMonth(s))

    recentAds.forEach(ad => {
      const k = getMonthKey(ad.createdAt)
      const bucket = monthlyMap.get(k)
      if (bucket) {
        const amt = Number(ad.spentAmount ?? 0)
        bucket.adRevenue += amt
        bucket.platformRevenue += amt
        bucket.totalRevenue += amt
      }
    })

    recentOrders.forEach(o => {
      const k = getMonthKey(o.createdAt)
      const bucket = monthlyMap.get(k)
      if (bucket) {
        const amt = o.totalAmount || 0
        bucket.orderRevenue += amt
        bucket.gmv += amt
        bucket.ordersCount += 1
        bucket.totalTransactions += 1
      }
    })

    recentFoodOrders.forEach(fo => {
      const k = getMonthKey(fo.createdAt)
      const bucket = monthlyMap.get(k)
      if (bucket) {
        const amt = fo.totalAmount || 0
        bucket.foodOrderRevenue += amt
        bucket.gmv += amt
        bucket.foodOrdersCount += 1
        bucket.totalTransactions += 1
      }
    })

    recentHotelBookings.forEach(hb => {
      const k = getMonthKey(hb.createdAt)
      const bucket = monthlyMap.get(k)
      if (bucket) {
        const amt = hb.totalPrice || 0
        bucket.hotelBookingRevenue += amt
        bucket.gmv += amt
        bucket.hotelBookingsCount += 1
        bucket.totalTransactions += 1
      }
    })

    recentSellers.forEach(s => {
      const k = getMonthKey(s.createdAt)
      const bucket = monthlyMap.get(k)
      if (bucket) {
        if (s.type === "PRODUCT") bucket.newProductSellers += 1
        else if (s.type === "SERVICE") bucket.newServiceSellers += 1
        bucket.totalNewSellers += 1
      }
    })

    recentHotelSellers.forEach(hs => {
      const k = getMonthKey(hs.createdAt)
      const bucket = monthlyMap.get(k)
      if (bucket) {
        bucket.newHotelSellers += 1
        bucket.totalNewSellers += 1
      }
    })

    recentRestaurantSellers.forEach(rs => {
      const k = getMonthKey(rs.createdAt)
      const bucket = monthlyMap.get(k)
      if (bucket) {
        bucket.newRestaurantSellers += 1
        bucket.totalNewSellers += 1
      }
    })

    recentProducts.forEach(p => {
      const k = getMonthKey(p.createdAt)
      const bucket = monthlyMap.get(k)
      if (bucket) bucket.newProducts += 1
    })

    recentServices.forEach(s => {
      const k = getMonthKey(s.createdAt)
      const bucket = monthlyMap.get(k)
      if (bucket) bucket.newServices += 1
    })

    recentFoods.forEach(f => {
      const k = getMonthKey(f.createdAt)
      const bucket = monthlyMap.get(k)
      if (bucket) bucket.newFoods += 1
    })

    recentRiders.forEach(r => {
      const k = getMonthKey(r.createdAt)
      const bucket = monthlyMap.get(k)
      if (bucket) bucket.newRiders += 1
    })

    const monthlyAnalytics = Array.from(monthlyMap.values())

    return NextResponse.json({
      // Legacy fields
      totalSellers: totalProductSellers + totalServiceSellers,
      totalCustomers,
      totalProducts,
      totalServices,
      totalOrders,
      totalRevenue: totalPlatformRevenue,
      subscriptionRevenue,
      adRevenue,
      commissionRevenue: 0,
      pendingSellers: pendingProductSellers + pendingServiceSellers,
      totalHotels,
      totalHotelSellers,
      totalRestaurantSellers,
      pendingHotelSellers,
      pendingRestaurantSellers,

      // New Granular Seller Counts
      totalAllSellers,
      totalProductSellers,
      totalServiceSellers,
      pendingProductSellers,
      pendingServiceSellers,
      totalPendingSellers,

      // Catalog & Offerings
      activeProducts,
      activeServices,
      totalFoods,
      activeFoods,
      activeHotels,

      // Rider Fleet
      totalRiders,
      approvedRiders,
      pendingRiders,

      // Transactions & Orders Breakdown
      totalFoodOrders,
      totalHotelBookings,
      totalTransactions: totalOrders + totalFoodOrders + totalHotelBookings,

      // Gross Volumes & Financials
      totalOrderVolume,
      totalFoodOrderVolume,
      totalHotelBookingVolume,
      grossMerchandiseValue,

      // Monthly Chart Data
      monthlyAnalytics,
    })
  } catch (error) {
    console.error("Error fetching admin overview:", error)
    return NextResponse.json(
      { error: "Failed to fetch overview" },
      { status: 500 }
    )
  }
}
