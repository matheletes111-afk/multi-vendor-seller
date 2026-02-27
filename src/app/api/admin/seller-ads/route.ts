import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

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

    const [ads, totalCount] = await Promise.all([
      prisma.sellerAd.findMany({
        skip,
        take,
        include: {
          seller: {
            include: {
              user: { select: { email: true, name: true } },
              store: { select: { name: true } },
            },
          },
          product: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
          _count: { select: { adClicks: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sellerAd.count(),
    ])

    const serialized = ads.map((ad) => ({
      ...ad,
      totalBudget: Number(ad.totalBudget),
      spentAmount: Number(ad.spentAmount),
      maxCpc: Number(ad.maxCpc),
      targetCountries: ad.targetCountries as string[] | null,
    }))

    const totalPages = Math.ceil(totalCount / perPage)
    return NextResponse.json({
      ads: serialized,
      totalCount,
      totalPages,
      page,
      perPage,
    })
  } catch (error) {
    console.error("Error fetching seller ads:", error)
    return NextResponse.json(
      { error: "Failed to fetch seller ads" },
      { status: 500 }
    )
  }
}
