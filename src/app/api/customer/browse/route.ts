import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** GET browse data: products, services. Sponsored ads only when not filtering by category/subcategory. Optional categoryId/subcategoryId to filter. Public (no auth required). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get("categoryId") ?? undefined
  const subcategoryId = searchParams.get("subcategoryId") ?? undefined
  const serviceCategoryId = searchParams.get("serviceCategoryId") ?? undefined

  const now = new Date()
  const isServiceCategoryOnly = Boolean(serviceCategoryId && !categoryId && !subcategoryId)
  const productWhere = {
    isActive: true,
    ...(categoryId && { categoryId }),
    ...(subcategoryId && { subcategoryId }),
  }
  const isFiltered = true

  const [
    sponsoredAdsRaw,
    products,
    categoryWithSubs,
    subcategoryWithCategory,
  ] = await Promise.all([
    isFiltered
      ? Promise.resolve([])
      : prisma.sellerAd.findMany({
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
    isServiceCategoryOnly
      ? Promise.resolve([])
      : prisma.product.findMany({
          where: productWhere,
          include: {
            category: true,
            seller: { include: { store: true } },
            variants: { take: 1, orderBy: { createdAt: "asc" }, select: { price: true, discount: true } },
            _count: { select: { reviews: true } },
          },
          take: 50,
          orderBy: { createdAt: "desc" },
        }),
    categoryId && !subcategoryId
      ? prisma.category.findUnique({
          where: { id: categoryId, isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            subcategories: {
              where: { isActive: true },
              orderBy: { name: "asc" },
              select: { id: true, name: true, slug: true },
            },
          },
        })
      : Promise.resolve(null),
    subcategoryId
      ? prisma.subcategory.findUnique({
          where: { id: subcategoryId, isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            category: { select: { id: true, name: true, slug: true } },
          },
        })
      : Promise.resolve(null),
  ])

  type AdRow = { spentAmount?: unknown; totalBudget?: unknown; [k: string]: unknown }
  const sponsoredAds = isFiltered ? [] : (sponsoredAdsRaw as AdRow[]).filter((ad) => Number(ad.spentAmount) < Number(ad.totalBudget))

  const productsWithListingPrice = products.map((p) => {
    const first = (p as { variants?: { price: number; discount: number }[] }).variants?.[0]
    return {
      ...p,
      basePrice: first?.price ?? 0,
      discount: first?.discount ?? 0,
    }
  })

  const categoryName = categoryWithSubs?.name ?? subcategoryWithCategory?.category?.name ?? null
  const subcategoryName = subcategoryWithCategory?.name ?? null
  const subcategories = categoryWithSubs?.subcategories ?? []
  const resolvedCategoryId = categoryId ?? subcategoryWithCategory?.category?.id ?? null

  const resolvedServiceCategoryId = serviceCategoryId ?? undefined
  const [services, serviceCategoryWithName] = await Promise.all([
    prisma.service.findMany({
      where: {
        isActive: true,
        ...(resolvedServiceCategoryId && { serviceCategoryId: resolvedServiceCategoryId }),
      },
      include: {
        serviceCategory: true,
        seller: { include: { store: true } },
        _count: { select: { reviews: true } },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    resolvedServiceCategoryId
      ? prisma.serviceCategory.findUnique({
          where: { id: resolvedServiceCategoryId, isActive: true },
          select: { name: true },
        })
      : Promise.resolve(null),
  ])

  const serviceCategoryName = serviceCategoryWithName?.name ?? null

  return NextResponse.json({
    categoryId: categoryId ?? null,
    subcategoryId: subcategoryId ?? null,
    serviceCategoryId: serviceCategoryId ?? null,
    resolvedCategoryId,
    categoryName,
    subcategoryName,
    serviceCategoryName,
    subcategories,
    sponsoredAds: sponsoredAds.map((ad: AdRow) => ({
      ...ad,
      totalBudget: Number(ad.totalBudget),
      spentAmount: Number(ad.spentAmount),
      maxCpc: Number(ad.maxCpc),
    })),
    products: productsWithListingPrice,
    services,
  })
}
