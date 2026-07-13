import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { checkProductLimit } from "@/lib/subscriptions"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import { sanitizeInput } from "@/lib/html-sanitization"
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

  // Filters
  const q = searchParams.get("q") || ""
  const startDate = searchParams.get("startDate") || ""
  const endDate = searchParams.get("endDate") || ""
  const categoryId = searchParams.get("categoryId") || ""
  const subcategoryId = searchParams.get("subcategoryId") || ""
  const minPrice = searchParams.get("minPrice") || ""
  const maxPrice = searchParams.get("maxPrice") || ""

  const where: any = { 
    sellerId: seller.id, 
    isDeleted: false 
  }

  if (q) {
    where.name = { contains: q, mode: "insensitive" }
  }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      where.createdAt.lte = end
    }
  }

  if (categoryId) {
    where.categoryId = categoryId
  }

  if (subcategoryId) {
    where.subcategoryId = subcategoryId
  }

  if (minPrice || maxPrice) {
    where.variants = {
      some: {}
    }
    if (minPrice) where.variants.some.price = { ...where.variants.some.price, gte: parseFloat(minPrice) }
    if (maxPrice) where.variants.some.price = { ...where.variants.some.price, lte: parseFloat(maxPrice) }
  }

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
  const nameRaw = typeof body.name === "string" ? body.name.trim() : ""
  const name = sanitizeInput(nameRaw)
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : ""
  if (!name || !categoryId) return NextResponse.json({ error: "Name and category are required" }, { status: 400 })
  const allowedCat = await sellerHasSelectedCategory(seller.id, categoryId)
  if (!allowedCat) return NextResponse.json({ error: "Category is not in your allowed list" }, { status: 400 })
  const category = await prisma.category.findUnique({
    where: { id: categoryId }
  })
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 400 })
  const isWeightMandatory = category.weightMandatory

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
    if (isWeightMandatory && (parsed.variant.weight === null || parsed.variant.weight <= 0)) {
      return NextResponse.json({ error: `Variant ${i + 1}: weight is mandatory for category ${category.name}` }, { status: 400 })
    }
    // Sanitize variant name if present
    if (parsed.variant.name) {
      parsed.variant.name = sanitizeInput(parsed.variant.name)
    }
    if (parsed.variant.details) {
      parsed.variant.details = sanitizeInput(parsed.variant.details)
    }
    variants.push(parsed.variant)
  }
  const conditionInput = typeof body.condition === "string" ? body.condition.toUpperCase() : "NEW"
  const condition = (conditionInput === "USED") ? "USED" : "NEW"
  const sanitizedDescription = typeof body.description === "string" ? sanitizeInput(body.description) : null

  try {
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId,
        subcategoryId,
        name,
        slug,
        description: sanitizedDescription,
        condition: condition as any,
        deliveryChargePerKm: Number(body.deliveryChargePerKm || 0),
        images: imagesData as object,
        variants: {
          create: variants.map((v) => ({
            name: v.name,
            sku: v.sku,
            price: v.price,
            discount: v.discount,
            hasGst: v.hasGst,
            stock: v.stock,
            weight: v.weight,
            images: v.images,
            attributes: v.attributes,
            specification: v.specification,
            details: v.details,
            returnType: v.returnType,
            returnDays: v.returnDays ?? undefined,
            replacementAllowed: v.replacementAllowed,
          })),
        },
      } as any,
      include: { category: true, subcategory: true, variants: true },
    })
    return NextResponse.json(product)
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err.code === "P2002") return NextResponse.json({ error: "Product with this name already exists" }, { status: 400 })
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}

/** DELETE multiple products (bulk soft-delete). */
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } })
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const { ids } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No product IDs provided" }, { status: 400 })
  }

  try {
    const result = await prisma.product.updateMany({
      where: {
        id: { in: ids },
        sellerId: seller.id,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
      },
    })

    return NextResponse.json({
      message: `Successfully deleted ${result.count} product(s)`,
      count: result.count,
    })
  } catch (error) {
    console.error("Bulk delete error:", error)
    return NextResponse.json({ error: "Failed to delete products" }, { status: 500 })
  }
}
