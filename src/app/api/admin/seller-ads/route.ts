import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import type { Prisma, SellerAdStatus } from "@prisma/client"

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

    const tab = searchParams.get("tab") ?? "all"
    const search = searchParams.get("search")?.trim()

    let where: Prisma.SellerAdWhereInput = {}
    const statusMap: Record<string, SellerAdStatus> = {
      pending: "PENDING_APPROVAL",
      active: "ACTIVE",
      paused: "PAUSED",
      ended: "ENDED",
      rejected: "REJECTED" as any,
    }
    if (tab !== "all" && statusMap[tab]) {
      where.status = statusMap[tab]
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { seller: { store: { name: { contains: search, mode: "insensitive" } } } },
        { seller: { user: { name: { contains: search, mode: "insensitive" } } } },
        { seller: { user: { email: { contains: search, mode: "insensitive" } } } },
        { hotelSeller: { user: { name: { contains: search, mode: "insensitive" } } } },
        { hotelSeller: { user: { email: { contains: search, mode: "insensitive" } } } },
        { restaurantSeller: { user: { name: { contains: search, mode: "insensitive" } } } },
        { restaurantSeller: { user: { email: { contains: search, mode: "insensitive" } } } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { email: { contains: search, mode: "insensitive" } } },
        { product: { name: { contains: search, mode: "insensitive" } } },
        { service: { name: { contains: search, mode: "insensitive" } } },
        { hotel: { name: { contains: search, mode: "insensitive" } } },
        { foodItem: { name: { contains: search, mode: "insensitive" } } },
      ]
    }

    const [ads, totalCount, stats, activeCount, pendingCount, rejectedCount] = await Promise.all([
      prisma.sellerAd.findMany({
        where,
        skip,
        take,
        include: {
          seller: {
            include: {
              user: { select: { email: true, name: true } },
              store: { select: { name: true } },
            },
          },
          hotelSeller: {
            include: {
              user: { select: { email: true, name: true } },
            },
          },
          customer: { select: { email: true, name: true } },
          product: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
          hotel: { select: { id: true, name: true } },
          restaurantSeller: {
            include: {
              user: { select: { email: true, name: true } },
            },
          },
          foodItem: { select: { id: true, name: true } },
          _count: { select: { adClicks: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sellerAd.count({ where }),
      prisma.sellerAd.aggregate({
        _sum: { spentAmount: true },
        _count: { _all: true },
      }),
      prisma.sellerAd.count({ where: { status: "ACTIVE" } }),
      prisma.sellerAd.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.sellerAd.count({ where: { status: "REJECTED" as any } }),
    ])

    const adIds = ads.map((a) => a.id)
    const usages = adIds.length > 0
      ? await prisma.couponUsage.findMany({
          where: { sellerAdId: { in: adIds } },
          include: { coupon: true }
        })
      : []

    const usageMap = Object.fromEntries(usages.filter(u => u.sellerAdId).map((u) => [u.sellerAdId!, u]))

    const serialized = ads.map((ad) => {
      const usage = usageMap[ad.id]
      let couponDiscount = 0
      if (usage?.coupon) {
        if (usage.coupon.discountType === "PERCENTAGE") {
          couponDiscount = (Number(ad.totalBudget) * usage.coupon.discountValue) / 100
        } else {
          couponDiscount = Math.min(usage.coupon.discountValue, Number(ad.totalBudget))
        }
      }
      return {
        ...ad,
        totalBudget: Number(ad.totalBudget),
        spentAmount: Number(ad.spentAmount),
        maxCpc: Number(ad.maxCpc),
        targetCountries: ad.targetCountries as string[] | null,
        couponCode: usage?.coupon?.code || null,
        couponDiscount,
      }
    })

    const totalPages = Math.ceil(totalCount / perPage)
    return NextResponse.json({
      ads: serialized,
      totalCount,
      totalPages,
      page,
      perPage,
      totalRevenue: Number(stats._sum.spentAmount || 0),
      activeCount,
      pendingCount,
      rejectedCount,
    })
  } catch (error) {
    console.error("Error fetching seller ads:", error)
    return NextResponse.json(
      { error: "Failed to fetch seller ads" },
      { status: 500 }
    )
  }
}
