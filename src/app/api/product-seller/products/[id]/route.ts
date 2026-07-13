import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { sanitizeInput } from "@/lib/html-sanitization"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const product = await prisma.product.findFirst({
    where: { id, sellerId: seller.id },
    include: { category: true, subcategory: true, variants: true },
  })

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  return NextResponse.json(product)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })
  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const existing = await prisma.product.findFirst({
    where: { id, sellerId: seller.id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({})) as {
    name?: string
    description?: string
    categoryId?: string
    subcategoryId?: string | null
    images?: string[]
    isActive?: boolean
    condition?: string
    deliveryChargePerKm?: number
    variants?: Array<{
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
      replacementAllowed?: boolean
    }>
  }

  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = sanitizeInput(body.name)
  if (body.description !== undefined) updateData.description = typeof body.description === "string" ? sanitizeInput(body.description) : body.description
  if (body.categoryId !== undefined) updateData.categoryId = body.categoryId
  if (body.subcategoryId !== undefined) {
    if (body.subcategoryId) {
      const catId = (body.categoryId ?? existing.categoryId) as string
      const sub = await prisma.subcategory.findFirst({
        where: { id: body.subcategoryId, categoryId: catId },
      })
      if (!sub) {
        return NextResponse.json(
          { error: "Subcategory does not belong to selected category" },
          { status: 400 }
        )
      }
    }
    updateData.subcategoryId = body.subcategoryId || null
  }
  if (body.images !== undefined) updateData.images = Array.isArray(body.images) ? body.images : (existing as { images: unknown }).images
  if (typeof body.isActive === "boolean") updateData.isActive = body.isActive
  if (typeof body.condition === "string") {
    const c = body.condition.toUpperCase()
    updateData.condition = (c === "USED") ? "USED" : "NEW"
  }
  if (body.deliveryChargePerKm !== undefined) updateData.deliveryChargePerKm = Number(body.deliveryChargePerKm || 0)

  if (body.name) {
    (updateData as { slug?: string }).slug = sanitizeInput(body.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  }

  if (Array.isArray(body.variants) && body.variants.length === 0) {
    return NextResponse.json({ error: "At least one variant is required" }, { status: 400 })
  }

  const categoryIdForCheck = (body.categoryId ?? existing.categoryId) as string
  const categoryObj = await prisma.category.findUnique({
    where: { id: categoryIdForCheck }
  })
  const isWeightMandatory = categoryObj?.weightMandatory ?? false

  try {
    if (Array.isArray(body.variants) && body.variants.length > 0) {
      await prisma.productVariant.deleteMany({ where: { productId: id } })
      type V = (typeof body.variants)[number] & { weight?: number }
      for (const v of body.variants as V[]) {
        const vName = typeof v?.name === "string" ? sanitizeInput(v.name) : "Variant"
        const vPrice = Number(v?.price ?? 0)
        const vStock = Number(v?.stock ?? 0)
        const vDiscount = Math.round(Number(v?.discount ?? 0) * 100) / 100
        const vWeight = v?.weight !== undefined && v?.weight !== null ? Number(v.weight) : null
        if (isNaN(vPrice) || vPrice <= 0 || isNaN(vStock) || vStock < 0) {
          return NextResponse.json({ error: "Each variant must have valid price and stock" }, { status: 400 })
        }
        if (isWeightMandatory && (vWeight === null || isNaN(vWeight) || vWeight <= 0)) {
          return NextResponse.json({ error: `Each variant must have a valid weight for category ${categoryObj?.name || ""}` }, { status: 400 })
        }
        const vReturnType = v?.returnType === "RETURNABLE" ? "RETURNABLE" : "NON_RETURNABLE"
        const vReturnDaysRaw = typeof v?.returnDays === "number" ? v.returnDays : undefined
        const vReturnDays =
          vReturnType === "RETURNABLE" && typeof vReturnDaysRaw === "number" && vReturnDaysRaw > 0
            ? Math.floor(vReturnDaysRaw)
            : null
        const replacementAllowed = v?.replacementAllowed === true
        await prisma.productVariant.create({
          data: {
            productId: id,
            name: vName,
            sku: typeof v?.sku === "string" ? v.sku || null : null,
            price: vPrice,
            discount: vDiscount,
            hasGst: v?.hasGst !== false,
            stock: Math.floor(vStock),
            weight: vWeight !== null && !isNaN(vWeight) ? vWeight : null,
            images: Array.isArray(v?.images) ? (v.images as object) : [],
            attributes: (v?.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes)) ? v.attributes as object : {},
            specification: typeof v?.specification === "string" ? v.specification : null,
            details: typeof v?.details === "string" ? sanitizeInput(v.details) : null,
            returnType: vReturnType,
            returnDays: vReturnDays ?? undefined,
            replacementAllowed,
          },
        })
      }
    }
    const product = await prisma.product.update({
      where: { id },
      data: updateData as any,
      include: { category: true, subcategory: true, variants: true },
    })
    return NextResponse.json(product)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `Failed to update: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })
  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const product = await prisma.product.findFirst({
    where: { id, sellerId: seller.id },
  })
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const deletedSlug = `${product.slug}-deleted-${Date.now()}`
  await prisma.product.update({ 
    where: { id },
    data: { 
      isDeleted: true,
      isActive: false,
      slug: deletedSlug
    } 
  })
  return NextResponse.json({ success: true })
}
