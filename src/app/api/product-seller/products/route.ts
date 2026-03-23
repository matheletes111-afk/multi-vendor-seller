import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { checkProductLimit } from "@/lib/subscriptions"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return NextResponse.json({
      products: [],
      totalCount: 0,
      totalPages: 1,
      page: 1,
      perPage: 10,
    })
  }

  const { searchParams } = new URL(request.url)
  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
  })

  const where = { sellerId: seller.id }

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      include: {
        category: true,
        subcategory: true,
        variants: true,
        _count: {
          select: {
            orderItems: true,
            reviews: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.count({ where }),
  ])

  const totalPages = Math.ceil(totalCount / perPage) || 1

  return NextResponse.json({
    products,
    totalCount,
    totalPages,
    page,
    perPage,
  })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  if (!seller.isApproved) return NextResponse.json({ error: "Your seller account is pending approval." }, { status: 403 })
  if (seller.isSuspended) return NextResponse.json({ error: "Your seller account has been suspended." }, { status: 403 })
  const limitCheck = await checkProductLimit(seller.id)
  if (!limitCheck.allowed) {
    return NextResponse.json({
      error: `Product limit reached. Plan allows ${limitCheck.limit}. Upgrade to add more.`,
    }, { status: 403 })
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : ""
  if (!name || !categoryId) return NextResponse.json({ error: "Name and category are required" }, { status: 400 })
  const subcategoryId = typeof body.subcategoryId === "string" ? body.subcategoryId || null : null
  if (subcategoryId) {
    const sub = await prisma.subcategory.findFirst({
      where: { id: subcategoryId, categoryId },
    })
    if (!sub) return NextResponse.json({ error: "Subcategory does not belong to selected category" }, { status: 400 })
  }
  const variantsRaw = Array.isArray(body.variants) ? body.variants : []
  if (variantsRaw.length === 0) return NextResponse.json({ error: "At least one variant is required" }, { status: 400 })
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const imagesData = Array.isArray(body.images) ? body.images : []
  type VariantInput = {
    name?: string
    sku?: string
    price?: number
    discount?: number
    hasGst?: boolean
    stock?: number
    images?: string[] | unknown
    attributes?: Record<string, string> | unknown
    specification?: string
    details?: string
    returnType?: "NON_RETURNABLE" | "RETURNABLE"
    returnDays?: number
  }
  const variants: {
    name: string
    sku: string | null
    price: number
    discount: number
    hasGst: boolean
    stock: number
    images: object
    attributes: object
    specification: string | null
    details: string | null
    returnType: "NON_RETURNABLE" | "RETURNABLE"
    returnDays: number | null
  }[] = []
  for (let i = 0; i < variantsRaw.length; i++) {
    const v = variantsRaw[i] as VariantInput
    const vName = typeof v?.name === "string" ? v.name.trim() : `Variant ${i + 1}`
    const vPrice = Number(v?.price ?? 0)
    const vStock = Number(v?.stock ?? 0)
    const vDiscount = Math.round(Number(v?.discount ?? 0) * 100) / 100
    if (isNaN(vPrice) || vPrice <= 0) return NextResponse.json({ error: `Variant ${i + 1}: valid price required` }, { status: 400 })
    if (isNaN(vStock) || vStock < 0) return NextResponse.json({ error: `Variant ${i + 1}: valid stock required` }, { status: 400 })
    const vReturnType = v?.returnType === "RETURNABLE" ? "RETURNABLE" : "NON_RETURNABLE"
    const vReturnDaysRaw = typeof v?.returnDays === "number" ? v.returnDays : undefined
    const vReturnDays =
      vReturnType === "RETURNABLE" && typeof vReturnDaysRaw === "number" && vReturnDaysRaw > 0
        ? Math.floor(vReturnDaysRaw)
        : null

    variants.push({
      name: vName,
      sku: typeof v?.sku === "string" ? v.sku || null : null,
      price: vPrice,
      discount: vDiscount,
      hasGst: v?.hasGst !== false,
      stock: Math.floor(vStock),
      images: Array.isArray(v?.images) ? (v.images as object) : [],
      attributes: (v?.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes)) ? v.attributes as object : {},
      specification: typeof v?.specification === "string" ? v.specification : null,
      details: typeof v?.details === "string" ? v.details : null,
      returnType: vReturnType,
      returnDays: vReturnDays,
    })
  }
  try {
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId,
        subcategoryId,
        name,
        slug,
        description: (body.description as string) ?? null,
        images: imagesData as object,
        variants: {
          create: variants.map((v) => ({
            name: v.name,
            sku: v.sku,
            price: v.price,
            discount: v.discount,
            hasGst: v.hasGst,
            stock: v.stock,
            images: v.images,
            attributes: v.attributes,
            specification: v.specification,
            details: v.details,
            returnType: v.returnType,
            returnDays: v.returnDays ?? undefined,
          })),
        },
      },
      include: { category: true, subcategory: true, variants: true },
    })
    return NextResponse.json(product)
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err.code === "P2002") return NextResponse.json({ error: "Product with this name already exists" }, { status: 400 })
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
