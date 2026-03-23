import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller || seller.type !== "SERVICE") {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
  })

  const where = { sellerId: seller.id, serviceId: { not: null } }

  const [ads, totalCount] = await Promise.all([
    prisma.sellerAd.findMany({
      where,
      skip,
      take,
      include: {
        service: { select: { id: true, name: true, slug: true } },
        _count: { select: { adClicks: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sellerAd.count({ where }),
  ])

  const serialized = ads.map((ad) => ({
    ...ad,
    totalBudget: Number(ad.totalBudget),
    spentAmount: Number(ad.spentAmount),
    maxCpc: Number(ad.maxCpc),
    targetCountries: ad.targetCountries as string[] | null,
  }))

  const totalPages = Math.ceil(totalCount / perPage) || 1

  return NextResponse.json({
    ads: serialized,
    totalCount,
    totalPages,
    page,
    perPage,
  })
}
