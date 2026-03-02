import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"

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
      additionalInfo?: Record<string, string> | unknown
    }>
  }

  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name.trim()
  if (body.description !== undefined) updateData.description = body.description
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

  if (body.name) {
    (updateData as { slug?: string }).slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  }

  if (Array.isArray(body.variants) && body.variants.length === 0) {
    return NextResponse.json({ error: "At least one variant is required" }, { status: 400 })
  }

  try {
    if (Array.isArray(body.variants) && body.variants.length > 0) {
      await prisma.productVariant.deleteMany({ where: { productId: id } })
      type V = (typeof body.variants)[number]
      for (const v of body.variants as V[]) {
        const vName = typeof v?.name === "string" ? v.name.trim() : "Variant"
        const vPrice = Number(v?.price ?? 0)
        const vStock = Number(v?.stock ?? 0)
        const vDiscount = Math.round(Number(v?.discount ?? 0) * 100) / 100
        if (isNaN(vPrice) || vPrice <= 0 || isNaN(vStock) || vStock < 0) {
          return NextResponse.json({ error: "Each variant must have valid price and stock" }, { status: 400 })
        }
        await prisma.productVariant.create({
          data: {
            productId: id,
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
            additionalInfo: (v?.additionalInfo && typeof v.additionalInfo === "object" && !Array.isArray(v.additionalInfo)) ? v.additionalInfo as object : null,
          },
        })
      }
    }
    const product = await prisma.product.update({
      where: { id },
      data: updateData as never,
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

  await prisma.product.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
