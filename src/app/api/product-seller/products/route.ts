import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { checkProductLimit } from "@/lib/subscriptions"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import {
  parseVariantInput,
  sellerHasSelectedCategory,
  slugFromName,
  type NormalizedVariant,
  type VariantInput,
} from "@/lib/product-seller-product-payload"

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
  const allowedCat = await sellerHasSelectedCategory(seller.id, categoryId)
  if (!allowedCat) return NextResponse.json({ error: "Category is not in your allowed list" }, { status: 400 })
  const subcategoryId = typeof body.subcategoryId === "string" ? body.subcategoryId || null : null
  if (subcategoryId) {
    const sub = await prisma.subcategory.findFirst({
      where: { id: subcategoryId, categoryId },
    })
    if (!sub) return NextResponse.json({ error: "Subcategory does not belong to selected category" }, { status: 400 })
  }
  const variantsRaw = Array.isArray(body.variants) ? body.variants : []
  if (variantsRaw.length === 0) return NextResponse.json({ error: "At least one variant is required" }, { status: 400 })
  const slug = slugFromName(name)
  const imagesData = Array.isArray(body.images) ? body.images : []
  const variants: NormalizedVariant[] = []
  for (let i = 0; i < variantsRaw.length; i++) {
    const parsed = parseVariantInput(variantsRaw[i] as VariantInput, i)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    variants.push(parsed.variant)
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
            replacementAllowed: v.replacementAllowed,
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
