import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma, ProductCondition } from "@prisma/client"

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const legacyCategoryId = searchParams.get("categoryId") ?? undefined
    const catsParam = searchParams.get("cats")
    const categoryIdsFromCats = catsParam ? parseCommaList(catsParam) : []
    const effectiveCategoryIds =
      categoryIdsFromCats.length > 0 ? categoryIdsFromCats : legacyCategoryId ? [legacyCategoryId] : []

    const subcategoryId = searchParams.get("subcategoryId") ?? undefined
    const qRaw = searchParams.get("q") ?? ""
    const q = typeof qRaw === "string" ? qRaw.trim() : ""

    const conditionFilter = parseCommaList(searchParams.get("condition")).filter((x) =>
      ["NEW", "USED"].includes(x)
    ) as ProductCondition[]

    const productWhere: Prisma.ProductWhereInput = {
      isActive: true,
      isDeleted: false,
      ...(effectiveCategoryIds.length > 0 && { categoryId: { in: effectiveCategoryIds } }),
      ...(subcategoryId && { subcategoryId }),
      ...(q && { name: { contains: q, mode: Prisma.QueryMode.insensitive } }),
      ...(conditionFilter.length > 0 && { condition: { in: conditionFilter } }),
    }

    const [allCategories, productsRaw] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      }),
      prisma.product.findMany({
        where: productWhere,
        select: {
          id: true,
          variants: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: {
              price: true,
              discount: true,
              attributes: true,
            },
          },
        },
      }),
    ])

    const brandSet = new Set<string>()
    const prices: number[] = []

    for (const p of productsRaw) {
      const v = p.variants[0]
      if (v) {
        const brand = extractBrand(v.attributes)
        brandSet.add(brand || "Other")
        const basePrice = v.price
        const discount = v.discount ?? 0
        const finalPrice = Math.max(0, basePrice - discount)
        prices.push(finalPrice)
      }
    }

    const brandsList = Array.from(brandSet).sort((a, b) => a.localeCompare(b))
    const priceExtent = {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
    }

    // Static Option Lists
    const ratings = [
      { value: "4", label: "4 stars & up" },
      { value: "3", label: "3 stars & up" },
      { value: "2", label: "2 stars & up" },
      { value: "1", label: "1 star & up" },
    ]

    const discounts = [
      { value: 10, label: "10% and above" },
      { value: 20, label: "20% and above" },
      { value: 30, label: "30% and above" },
      { value: 40, label: "40% and above" },
      { value: 50, label: "50% and above" },
    ]

    const returnPolicies = [
      { code: "fr", label: "Free Returns (7+ days)" },
      { code: "7", label: "7 Days Return" },
      { code: "10", label: "10 Days Return" },
      { code: "30", label: "30 Days Return" },
      { code: "none", label: "Non-returnable" },
    ]

    const conditions = [
      { code: "NEW", label: "New" },
      { code: "USED", label: "Used" },
    ]

    const availability = [
      { code: "in", label: "In Stock" },
      { code: "out", label: "Out of Stock" },
    ]

    const sellerTypes = [
      { code: "branded", label: "Branded Store" },
      { code: "regular", label: "Regular Seller" },
    ]

    return NextResponse.json({
      success: true,
      message: "Filter parameters fetched successfully",
      data: {
        categories: allCategories,
        brands: brandsList,
        priceRange: priceExtent,
        ratings,
        discounts,
        returnPolicies,
        conditions,
        availability,
        sellerTypes,
      },
    })
  } catch (error) {
    console.error("Filters parameters API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }, { status: 500 })
  }
}
