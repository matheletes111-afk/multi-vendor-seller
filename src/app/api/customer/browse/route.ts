import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** GET browse data: sponsored ads, products, services. Optional categoryId/subcategoryId to filter. Public (no auth required). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get("categoryId") ?? undefined
  const subcategoryId = searchParams.get("subcategoryId") ?? undefined

  const now = new Date()
  const productWhere = {
    isActive: true,
    ...(categoryId && { categoryId }),
    ...(subcategoryId && { subcategoryId }),
  }
  const serviceWhere = {
    isActive: true,
    ...(categoryId && { categoryId }),
  }

  const [sponsoredAdsRaw, products, services] = await Promise.all([
    prisma.sellerAd.findMany({
      where: {
        status: "ACTIVE",
        startAt: { lte: now },
        endAt: { gte: now },
      },
      include: {
        product: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
      take: 12,
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: productWhere,
      include: {
        category: true,
        seller: { include: { store: true } },
        _count: { select: { reviews: true } },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    prisma.service.findMany({
      where: serviceWhere,
      include: {
        category: true,
        seller: { include: { store: true } },
        _count: { select: { reviews: true } },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
  ])

  const sponsoredAds = sponsoredAdsRaw.filter((ad) => Number(ad.spentAmount) < Number(ad.totalBudget))

  return NextResponse.json({
    categoryId: categoryId ?? null,
    subcategoryId: subcategoryId ?? null,
    sponsoredAds: sponsoredAds.map((ad) => ({
      ...ad,
      totalBudget: Number(ad.totalBudget),
      spentAmount: Number(ad.spentAmount),
      maxCpc: Number(ad.maxCpc),
    })),
    products,
    services,
  })
}
