import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma, ReturnPolicyType, SubscriptionPlan } from "@prisma/client"

const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 100

type EnrichedProduct = {
  id: string
  name: string
  slug: string
  description: string | null
  images: unknown
  isActive: boolean
  isFeatured: boolean
  createdAt: Date
  category: { id: string; name: string; slug: string }
  seller: {
    store: { name: string; logo: string | null } | null
    subscription: { plan: { name: SubscriptionPlan } } | null
  } | null
  variants: { price: number; discount: number; stock: number; returnType: ReturnPolicyType; returnDays: number | null; attributes: unknown }[]
  _count: { reviews: number }
  basePrice: number
  discount: number
  finalPrice: number
  avgRating: number
  soldCount: number
  brand: string | null
  stock: number
  returnType: ReturnPolicyType
  returnDays: number | null
  isBrandedSeller: boolean
  discountPercent: number
}

function parseCommaList(s: string | null): string[] {
  if (!s || !s.trim()) return []
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
}

function extractBrand(attributes: unknown): string | null {
  if (!attributes || typeof attributes !== "object") return null
  const o = attributes as Record<string, unknown>
  const b = o.brand ?? o.Brand
  return typeof b === "string" && b.trim() ? b.trim() : null
}

function computeDiscountPercent(basePrice: number, discount: number): number {
  if (basePrice <= 0) return 0
  return Math.round((discount / basePrice) * 100)
}

function isBrandedSeller(
  store: { logo: string | null } | null | undefined,
  planName: SubscriptionPlan | undefined
): boolean {
  if (store?.logo) return true
  if (planName && planName !== SubscriptionPlan.FREE) return true
  return false
}

function matchesReturnFilters(
  returnType: ReturnPolicyType,
  returnDays: number | null,
  codes: string[]
): boolean {
  return codes.some((code) => {
    switch (code) {
      case "fr":
        return returnType === ReturnPolicyType.RETURNABLE && (returnDays ?? 0) >= 7
      case "7":
        return returnDays === 7
      case "10":
        return returnDays === 10
      case "30":
        return returnDays === 30
      case "none":
        return returnType === ReturnPolicyType.NON_RETURNABLE
      default:
        return false
    }
  })
}

/** GET browse data: products, services. Public. Supports extended filters (brands, rating, discount, return policy, stock, seller type). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const legacyCategoryId = searchParams.get("categoryId") ?? undefined
  const catsParam = searchParams.get("cats")
  const categoryIdsFromCats = catsParam ? parseCommaList(catsParam) : []
  const effectiveCategoryIds =
    categoryIdsFromCats.length > 0 ? categoryIdsFromCats : legacyCategoryId ? [legacyCategoryId] : []

  const subcategoryId = searchParams.get("subcategoryId") ?? undefined
  const serviceCategoryId = searchParams.get("serviceCategoryId") ?? undefined

  const sortParam = searchParams.get("sort")
  const sort =
    sortParam === "price_desc" ||
    sortParam === "price_asc" ||
    sortParam === "newest" ||
    sortParam === "featured" ||
    sortParam === "bestseller" ||
    sortParam === "rating"
      ? sortParam
      : "newest"

  const minPriceParam = searchParams.get("minPrice")
  const maxPriceParam = searchParams.get("maxPrice")
  const minPriceRaw = minPriceParam == null ? NaN : Number(minPriceParam)
  const maxPriceRaw = maxPriceParam == null ? NaN : Number(maxPriceParam)
  const minPrice = Number.isFinite(minPriceRaw) ? Math.max(0, minPriceRaw) : undefined
  const maxPrice = Number.isFinite(maxPriceRaw) ? Math.max(0, maxPriceRaw) : undefined

  const qRaw = searchParams.get("q") ?? ""
  const q = typeof qRaw === "string" ? qRaw.trim() : ""

  const brandsFilter = parseCommaList(searchParams.get("brands"))
  const minRatingParam = searchParams.get("rating")
  const minRating =
    minRatingParam === "1" || minRatingParam === "2" || minRatingParam === "3" || minRatingParam === "4"
      ? Number(minRatingParam)
      : undefined

  const discFilter = parseCommaList(searchParams.get("disc"))
    .map((x) => Number(x))
    .filter((n) => [10, 20, 30, 40, 50].includes(n))

  const retFilter = parseCommaList(searchParams.get("ret")).filter((x) =>
    ["fr", "7", "10", "30", "none"].includes(x)
  )

  const availParam = searchParams.get("avail")
  const avail = availParam === "in" || availParam === "out" ? availParam : undefined

  const sellerParam = searchParams.get("seller")
  const sellerFilter = sellerParam === "branded" || sellerParam === "regular" ? sellerParam : undefined

  const rawPage = Number(searchParams.get("page") ?? "1")
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const rawPageSize = Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE))
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1 && rawPageSize <= MAX_PAGE_SIZE
      ? Math.floor(rawPageSize)
      : DEFAULT_PAGE_SIZE

  const now = new Date()
  const isServiceCategoryOnly = Boolean(serviceCategoryId && effectiveCategoryIds.length === 0 && !subcategoryId)

  const productWhere: Prisma.ProductWhereInput = {
    isActive: true,
    isDeleted: false,
    ...(effectiveCategoryIds.length > 0 && { categoryId: { in: effectiveCategoryIds } }),
    ...(subcategoryId && { subcategoryId }),
    ...(q && { name: { contains: q, mode: Prisma.QueryMode.insensitive } }),
  }

  const isFiltered = true

  const [
    sponsoredAdsRaw,
    allProductsRaw,
    categoryWithSubs,
    subcategoryWithCategory,
    allCategories,
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
            seller: {
              include: {
                store: true,
                subscription: { include: { plan: { select: { name: true } } } },
              },
            },
            variants: {
              take: 1,
              orderBy: { createdAt: "asc" },
              select: {
                price: true,
                discount: true,
                stock: true,
                returnType: true,
                returnDays: true,
                attributes: true,
              },
            },
            _count: { select: { reviews: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
    effectiveCategoryIds.length === 1 && !subcategoryId
      ? prisma.category.findUnique({
          where: { id: effectiveCategoryIds[0], isActive: true },
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
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ])

  type AdRow = { spentAmount?: unknown; totalBudget?: unknown; [k: string]: unknown }
  const sponsoredAds = isFiltered ? [] : (sponsoredAdsRaw as AdRow[]).filter((ad) => Number(ad.spentAmount) < Number(ad.totalBudget))

  const productIds = allProductsRaw.map((p) => p.id)

  const [ratingRows, soldRows] =
    productIds.length > 0
      ? await Promise.all([
          prisma.review.groupBy({
            by: ["productId"],
            where: { productId: { in: productIds } },
            _avg: { rating: true },
          }),
          prisma.orderItem.groupBy({
            by: ["productId"],
            where: { productId: { in: productIds } },
            _sum: { quantity: true },
          }),
        ])
      : [[], []]

  const ratingByProduct = Object.fromEntries(
    ratingRows.map((r) => [r.productId, { avg: Number(r._avg.rating ?? 0) }])
  ) as Record<string, { avg: number }>
  const soldByProduct = Object.fromEntries(
    soldRows.map((r) => [r.productId, r._sum.quantity ?? 0])
  ) as Record<string, number>

  const enriched: EnrichedProduct[] = allProductsRaw.map((p) => {
    const v = p.variants[0]
    const basePrice = v?.price ?? 0
    const discount = v?.discount ?? 0
    const finalPrice = Math.max(0, basePrice - discount)
    const planName = p.seller?.subscription?.plan?.name
    const stock = v?.stock ?? 0
    const returnType = v?.returnType ?? ReturnPolicyType.NON_RETURNABLE
    const returnDays = v?.returnDays ?? null
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      images: p.images,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      createdAt: p.createdAt,
      category: p.category,
      seller: p.seller
        ? {
            store: p.seller.store ? { name: p.seller.store.name, logo: p.seller.store.logo } : null,
            subscription: p.seller.subscription
              ? { plan: { name: p.seller.subscription.plan.name } }
              : null,
          }
        : null,
      variants: v
        ? [
            {
              price: v.price,
              discount: v.discount,
              stock,
              returnType: v.returnType,
              returnDays: v.returnDays,
              attributes: v.attributes,
            },
          ]
        : [],
      _count: p._count,
      basePrice,
      discount,
      finalPrice,
      avgRating: ratingByProduct[p.id]?.avg ?? 0,
      soldCount: soldByProduct[p.id] ?? 0,
      brand: extractBrand(v?.attributes),
      stock,
      returnType,
      returnDays,
      isBrandedSeller: isBrandedSeller(p.seller?.store ?? null, planName),
      discountPercent: computeDiscountPercent(basePrice, discount),
    }
  })

  const brandSet = new Set<string>()
  for (const p of enriched) {
    brandSet.add(p.brand || "Other")
  }
  const brandsList = Array.from(brandSet).sort((a, b) => a.localeCompare(b))

  const prices = enriched.map((p) => p.finalPrice)
  const priceExtent = {
    min: prices.length > 0 ? Math.min(...prices) : 0,
    max: prices.length > 0 ? Math.max(...prices) : 0,
  }

  let filtered = enriched.filter((p) => {
    if (brandsFilter.length > 0) {
      const b = (p.brand || "Other").toLowerCase()
      if (!brandsFilter.some((f) => b === f.toLowerCase())) return false
    }
    if (minRating != null && p.avgRating < minRating) return false
    if (discFilter.length > 0 && !discFilter.some((d) => p.discountPercent >= d)) return false
    if (retFilter.length > 0 && !matchesReturnFilters(p.returnType, p.returnDays, retFilter)) return false
    if (avail === "in" && p.stock <= 0) return false
    if (avail === "out" && p.stock > 0) return false
    if (sellerFilter === "branded" && !p.isBrandedSeller) return false
    if (sellerFilter === "regular" && p.isBrandedSeller) return false
    const minF = minPrice ?? 0
    if (p.finalPrice < minF) return false
    if (typeof maxPrice === "number" && p.finalPrice > maxPrice) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "price_asc") return a.finalPrice - b.finalPrice
    if (sort === "price_desc") return b.finalPrice - a.finalPrice
    if (sort === "featured") return Number(b.isFeatured) - Number(a.isFeatured) || b.createdAt.getTime() - a.createdAt.getTime()
    if (sort === "bestseller") return b.soldCount - a.soldCount || b.createdAt.getTime() - a.createdAt.getTime()
    if (sort === "rating") return b.avgRating - a.avgRating || b._count.reviews - a._count.reviews
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  const totalProducts = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedProducts = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const categoryName = categoryWithSubs?.name ?? subcategoryWithCategory?.category?.name ?? null
  const subcategoryName = subcategoryWithCategory?.name ?? null
  const subcategories = categoryWithSubs?.subcategories ?? []
  const resolvedCategoryId = effectiveCategoryIds[0] ?? subcategoryWithCategory?.category?.id ?? legacyCategoryId ?? null

  const isProductCategoryFilter = Boolean(effectiveCategoryIds.length > 0 || subcategoryId)
  const resolvedServiceCategoryId = serviceCategoryId ?? undefined
  const [services, serviceCategoryWithName] = await Promise.all([
    isProductCategoryFilter
      ? Promise.resolve([])
      : prisma.service.findMany({
          where: {
            isActive: true,
            isDeleted: false,
            ...(resolvedServiceCategoryId && { serviceCategoryId: resolvedServiceCategoryId }),
            ...(q && { name: { contains: q, mode: Prisma.QueryMode.insensitive } }),
          },
          include: {
            serviceCategory: true,
            seller: { include: { store: true } },
            _count: { select: { reviews: true } },
          },
          take: 50,
          orderBy: { createdAt: "desc" },
        }),
    resolvedServiceCategoryId && !isProductCategoryFilter
      ? prisma.serviceCategory.findUnique({
          where: { id: resolvedServiceCategoryId, isActive: true },
          select: { name: true },
        })
      : Promise.resolve(null),
  ])

  const serviceCategoryName = serviceCategoryWithName?.name ?? null

  const serializeProduct = (p: EnrichedProduct) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    images: p.images,
    isFeatured: p.isFeatured,
    createdAt: p.createdAt.toISOString(),
    category: p.category,
    seller: p.seller,
    variants: p.variants,
    _count: p._count,
    basePrice: p.basePrice,
    discount: p.discount,
    finalPrice: p.finalPrice,
    avgRating: p.avgRating,
    soldCount: p.soldCount,
    brand: p.brand,
    stock: p.stock,
    returnType: p.returnType,
    returnDays: p.returnDays,
    isBrandedSeller: p.isBrandedSeller,
    discountPercent: p.discountPercent,
  })

  return NextResponse.json({
    page: currentPage,
    pageSize,
    totalProducts,
    totalPages,
    sort,
    minPrice: minPrice ?? null,
    maxPrice: maxPrice ?? null,
    categoryId: legacyCategoryId ?? null,
    cats: effectiveCategoryIds,
    subcategoryId: subcategoryId ?? null,
    serviceCategoryId: serviceCategoryId ?? null,
    resolvedCategoryId,
    categoryName,
    subcategoryName,
    serviceCategoryName,
    subcategories,
    filterMeta: {
      categories: allCategories,
      brands: brandsList,
      priceExtent,
    },
    sponsoredAds: sponsoredAds.map((ad: AdRow) => ({
      ...ad,
      totalBudget: Number(ad.totalBudget),
      spentAmount: Number(ad.spentAmount),
      maxCpc: Number(ad.maxCpc),
    })),
    products: paginatedProducts.map(serializeProduct),
    services,
  })
}
