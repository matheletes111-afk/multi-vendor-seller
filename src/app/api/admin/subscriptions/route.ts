import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { PlanType } from "@prisma/client"
import { activateOrQueuePurchase } from "@/lib/subscriptions"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import { startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isValid } from "date-fns"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const yearString = searchParams.get("year")
    const monthString = searchParams.get("month")
    const fromString = searchParams.get("from")
    const toString = searchParams.get("to")

    let dateFilter: any = {}

    if (fromString || toString) {
      if (fromString) {
        const fromDate = parseISO(fromString)
        if (isValid(fromDate)) dateFilter.gte = fromDate
      }
      if (toString) {
        const toDate = parseISO(toString)
        if (isValid(toDate)) dateFilter.lte = toDate
      }
    } else if (yearString) {
      const year = parseInt(yearString, 10)
      if (!isNaN(year)) {
        if (monthString) {
          const month = parseInt(monthString, 10) - 1 // 0-indexed
          if (!isNaN(month) && month >= 0 && month <= 11) {
            const date = new Date(year, month, 1)
            dateFilter.gte = startOfMonth(date)
            dateFilter.lte = endOfMonth(date)
          }
        } else {
          const date = new Date(year, 0, 1)
          dateFilter.gte = startOfYear(date)
          dateFilter.lte = endOfYear(date)
        }
      }
    }

    const where: any = {}
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter
    }

    const sellerTypeParam = searchParams.get("sellerType") || "PRODUCT_SERVICE"
    const sellerType = sellerTypeParam.toUpperCase()

    let subscriptions: any[] = []
    let totalCount = 0
    let activeCount = 0
    let filteredForRevenue: any[] = []
    let planCounts: any[] = []
    let planActiveCounts: any[] = []

    const plans = await prisma.plan.findMany({
      where: { type: sellerType as any },
      orderBy: { price: "asc" },
    })

    const searchQuery = (searchParams.get("search") || "").trim()

    let searchWhere: any = { ...where }
    if (searchQuery) {
      if (sellerType === "HOTEL") {
        searchWhere.OR = [
          { hotelSeller: { user: { name: { contains: searchQuery, mode: "insensitive" } } } },
          { hotelSeller: { user: { email: { contains: searchQuery, mode: "insensitive" } } } },
          { hotelSeller: { user: { phone: { contains: searchQuery, mode: "insensitive" } } } },
          { hotelSeller: { businessInfo: { businessName: { contains: searchQuery, mode: "insensitive" } } } },
          { plan: { displayName: { contains: searchQuery, mode: "insensitive" } } },
          { plan: { name: { contains: searchQuery, mode: "insensitive" } } },
        ]
      } else if (sellerType === "RESTAURANT") {
        searchWhere.OR = [
          { restaurantSeller: { user: { name: { contains: searchQuery, mode: "insensitive" } } } },
          { restaurantSeller: { user: { email: { contains: searchQuery, mode: "insensitive" } } } },
          { restaurantSeller: { user: { phone: { contains: searchQuery, mode: "insensitive" } } } },
          { restaurantSeller: { businessInfo: { businessName: { contains: searchQuery, mode: "insensitive" } } } },
          { plan: { displayName: { contains: searchQuery, mode: "insensitive" } } },
          { plan: { name: { contains: searchQuery, mode: "insensitive" } } },
        ]
      } else {
        searchWhere.OR = [
          { seller: { user: { name: { contains: searchQuery, mode: "insensitive" } } } },
          { seller: { user: { email: { contains: searchQuery, mode: "insensitive" } } } },
          { seller: { user: { phone: { contains: searchQuery, mode: "insensitive" } } } },
          { seller: { store: { name: { contains: searchQuery, mode: "insensitive" } } } },
          { seller: { businessInfo: { businessName: { contains: searchQuery, mode: "insensitive" } } } },
          { plan: { displayName: { contains: searchQuery, mode: "insensitive" } } },
          { plan: { name: { contains: searchQuery, mode: "insensitive" } } },
        ]
      }

      const upperStatus = searchQuery.toUpperCase()
      if (
        [
          "ACTIVE",
          "CANCELED",
          "PAST_DUE",
          "TRIALING",
          "IN_GRACE_PERIOD",
          "EXPIRED",
          "REVOKED",
        ].includes(upperStatus)
      ) {
        searchWhere.OR.push({ status: upperStatus })
      }
    }

    const isExport = searchParams.get("export") === "true" || searchParams.get("all") === "true"

    if (sellerType === "HOTEL") {
      const [
        hotelSubs,
        hotelTotalCount,
        hotelActiveCount,
        hotelFilteredForRevenue,
        hotelPlanCounts,
        hotelPlanActiveCounts,
      ] = await Promise.all([
        prisma.hotelSubscription.findMany({
          where: searchWhere,
          ...(isExport ? {} : { skip, take }),
          include: {
            hotelSeller: {
              include: {
                user: true,
                businessInfo: true,
              },
            },
            plan: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.hotelSubscription.count({ where: searchWhere }),
        prisma.hotelSubscription.count({ where: { ...searchWhere, status: "ACTIVE" } }),
        prisma.hotelSubscription.findMany({
          where: searchWhere,
          select: { paidPrice: true, plan: { select: { price: true } } },
        }),
        prisma.hotelSubscription.groupBy({ 
          by: ["planId"], 
          where: searchWhere,
          _count: true 
        }),
        prisma.hotelSubscription.groupBy({
          by: ["planId"],
          where: { ...searchWhere, status: "ACTIVE" },
          _count: true,
        }),
      ])

      subscriptions = hotelSubs.map((s) => ({
        ...s,
        seller: {
          ...s.hotelSeller,
          store: {
            name: s.hotelSeller.businessInfo?.businessName || "",
          },
          type: "HOTEL"
        }
      }))
      totalCount = hotelTotalCount
      activeCount = hotelActiveCount
      filteredForRevenue = hotelFilteredForRevenue
      planCounts = hotelPlanCounts
      planActiveCounts = hotelPlanActiveCounts

    } else if (sellerType === "RESTAURANT") {
      const [
        restaurantSubs,
        restaurantTotalCount,
        restaurantActiveCount,
        restaurantFilteredForRevenue,
        restaurantPlanCounts,
        restaurantPlanActiveCounts,
      ] = await Promise.all([
        prisma.restaurantSubscription.findMany({
          where: searchWhere,
          ...(isExport ? {} : { skip, take }),
          include: {
            restaurantSeller: {
              include: {
                user: true,
                businessInfo: true,
              },
            },
            plan: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.restaurantSubscription.count({ where: searchWhere }),
        prisma.restaurantSubscription.count({ where: { ...searchWhere, status: "ACTIVE" } }),
        prisma.restaurantSubscription.findMany({
          where: searchWhere,
          select: { paidPrice: true, plan: { select: { price: true } } },
        }),
        prisma.restaurantSubscription.groupBy({ 
          by: ["planId"], 
          where: searchWhere,
          _count: true 
        }),
        prisma.restaurantSubscription.groupBy({
          by: ["planId"],
          where: { ...searchWhere, status: "ACTIVE" },
          _count: true,
        }),
      ])

      subscriptions = restaurantSubs.map((s) => ({
        ...s,
        seller: {
          ...s.restaurantSeller,
          store: {
            name: s.restaurantSeller.businessInfo?.businessName || "",
          },
          type: "RESTAURANT"
        }
      }))
      totalCount = restaurantTotalCount
      activeCount = restaurantActiveCount
      filteredForRevenue = restaurantFilteredForRevenue
      planCounts = restaurantPlanCounts
      planActiveCounts = restaurantPlanActiveCounts

    } else {
      const [
        prodSubs,
        prodTotalCount,
        prodActiveCount,
        prodFilteredForRevenue,
        prodPlanCounts,
        prodPlanActiveCounts,
      ] = await Promise.all([
        prisma.subscription.findMany({
          where: searchWhere,
          ...(isExport ? {} : { skip, take }),
          include: {
            seller: {
              include: {
                user: true,
                store: true,
                businessInfo: true,
              },
            },
            plan: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.subscription.count({ where: searchWhere }),
        prisma.subscription.count({ where: { ...searchWhere, status: "ACTIVE" } }),
        prisma.subscription.findMany({
          where: searchWhere,
          select: { paidPrice: true, plan: { select: { price: true } } },
        }),
        prisma.subscription.groupBy({ 
          by: ["planId"], 
          where: searchWhere,
          _count: true 
        }),
        prisma.subscription.groupBy({
          by: ["planId"],
          where: { ...searchWhere, status: "ACTIVE" },
          _count: true,
        }),
      ])

      subscriptions = prodSubs
      totalCount = prodTotalCount
      activeCount = prodActiveCount
      filteredForRevenue = prodFilteredForRevenue
      planCounts = prodPlanCounts
      planActiveCounts = prodPlanActiveCounts
    }

    const subIds = subscriptions.map((s) => s.id)
    const usages = subIds.length > 0
      ? await prisma.couponUsage.findMany({
          where: { subscriptionId: { in: subIds } },
          include: { coupon: true }
        })
      : []

    const usageMap = Object.fromEntries(usages.filter(u => u.subscriptionId).map((u) => [u.subscriptionId!, u]))

    const sellerIds = subscriptions.map((s: any) => s.sellerId || s.hotelSellerId || s.restaurantSellerId).filter(Boolean)
    const purchases = sellerIds.length > 0
      ? await prisma.subscriptionPurchase.findMany({
          where: {
            OR: [
              { sellerId: { in: sellerIds } },
              { hotelSellerId: { in: sellerIds } },
              { restaurantSellerId: { in: sellerIds } },
            ],
            status: { in: ["ACTIVE", "EXPIRED", "CANCELLED"] },
          },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        })
      : []
    const purchaseMap = new Map<string, any>()
    for (const p of purchases) {
      const sid = p.sellerId || p.hotelSellerId || p.restaurantSellerId
      if (!sid) continue
      const existing = purchaseMap.get(sid)
      if (!existing || (existing.status !== "ACTIVE" && p.status === "ACTIVE")) {
        purchaseMap.set(sid, p)
      }
    }

    const enrichedSubscriptions = subscriptions.map((s: any) => {
      const usage = usageMap[s.id]
      const sellerId = s.sellerId || s.hotelSellerId || s.restaurantSellerId
      const matchedPurchase = sellerId ? purchaseMap.get(sellerId) : null
      const planSnapshot = (s.planSnapshot as any) || s.plan
      const catalogPrice = planSnapshot?.price ?? (s.plan?.price || 0)
      let couponDiscount = 0
      const couponCode = usage?.coupon?.code || matchedPurchase?.couponCode || null
      if (matchedPurchase && matchedPurchase.discountAmount > 0) {
        couponDiscount = matchedPurchase.discountAmount
      } else
      if (usage?.coupon) {
        if (usage.coupon.discountType === "PERCENTAGE") {
          couponDiscount = (catalogPrice * usage.coupon.discountValue) / 100
        } else {
          couponDiscount = Math.min(usage.coupon.discountValue, catalogPrice)
        }
      }
      const finalPaidAmount = s.paidPrice !== null && s.paidPrice !== undefined
        ? s.paidPrice
        : (matchedPurchase?.paidPrice !== null && matchedPurchase?.paidPrice !== undefined ? matchedPurchase.paidPrice : Math.max(0, catalogPrice - couponDiscount))

      return {
        ...s,
        catalogPrice,
        paidPrice: s.paidPrice !== null && s.paidPrice !== undefined ? s.paidPrice : catalogPrice,
        couponCode,
        couponDiscount,
        finalPaidAmount,
      }
    })

    // Guarantee latest created / updated subscriptions always come first
    enrichedSubscriptions.sort((a, b) => {
      const timeA = Math.max(
        a.createdAt ? new Date(a.createdAt).getTime() : 0,
        a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      )
      const timeB = Math.max(
        b.createdAt ? new Date(b.createdAt).getTime() : 0,
        b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      )
      return timeB - timeA
    })

    const purchaseRevenueAgg = await prisma.subscriptionPurchase.aggregate({
      where: {
        sellerType: sellerType as any,
        status: { in: ["ACTIVE", "QUEUED", "EXPIRED"] },
        paidPrice: { gt: 0 },
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      _sum: { paidPrice: true },
    })

    const totalLedgerRevenue = Number(purchaseRevenueAgg._sum.paidPrice || 0)
    const totalRevenue = totalLedgerRevenue > 0
      ? totalLedgerRevenue
      : filteredForRevenue.reduce((sum, s) => {
          const p = s.paidPrice !== null && s.paidPrice !== undefined ? s.paidPrice : (s.plan?.price || 0)
          return sum + p
        }, 0)
    const planCountMap = Object.fromEntries(planCounts.map((p: any) => [p.planId, p._count]))
    const planActiveMap = Object.fromEntries(planActiveCounts.map((p: any) => [p.planId, p._count]))
    const totalPages = Math.ceil(totalCount / perPage)

    return NextResponse.json({
      subscriptions: enrichedSubscriptions,
      totalCount,
      totalPages,
      page,
      perPage,
      stats: {
        totalCount,
        activeCount,
        totalRevenue,
        plansCount: plans.length,
      },
      plans,
      planCountMap,
      planActiveMap,
    })
  } catch (error) {
    console.error("Error fetching subscriptions:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    )
  }
}


export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { sellerType, sellerId, planId, durationDays, note } = body

    if (!sellerType || !sellerId || !planId) {
      return NextResponse.json({ error: "sellerType, sellerId, and planId are required" }, { status: 400 })
    }

    const typeEnum =
      sellerType === "HOTEL"
        ? PlanType.HOTEL
        : sellerType === "RESTAURANT"
        ? PlanType.RESTAURANT
        : PlanType.PRODUCT_SERVICE

    const plan = await prisma.plan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    const result = await activateOrQueuePurchase({
      sellerType: typeEnum,
      sellerId: typeEnum === PlanType.PRODUCT_SERVICE ? sellerId : null,
      hotelSellerId: typeEnum === PlanType.HOTEL ? sellerId : null,
      restaurantSellerId: typeEnum === PlanType.RESTAURANT ? sellerId : null,
      planId: plan.id,
      durationDays: durationDays ? Number(durationDays) : (plan.duration || 30),
      price: plan.price,
      paidPrice: 0,
      paymentMethod: "ADMIN_GRANT",
      adminGrantedBy: session.user.id,
      note: note || "Granted by Admin",
      paidAt: new Date(),
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[POST /api/admin/subscriptions] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to grant subscription" },
      { status: 500 }
    )
  }
}
