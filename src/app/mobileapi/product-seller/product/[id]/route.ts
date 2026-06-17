import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../../_helpers/seller-auth"
import { processHybridProductRequest } from "../../../_helpers/product-upload"

export const dynamic = 'force-dynamic'

/**
 * GET /mobileapi/product-seller/product/[id]
 * Get single product details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const { id } = await params

  try {
    const seller = await prisma.seller.findUnique({ where: { userId } })
    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

    const product = await prisma.product.findFirst({
      where: { id, sellerId: seller.id, isDeleted: false },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subcategory: { select: { id: true, name: true, slug: true } },
        variants: true
      },
    })

    if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error("Mobile get product error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /mobileapi/product-seller/product/[id]
 * Update an existing product. Supports JSON or FormData (for files).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const { id } = await params

  try {
    const seller = await prisma.seller.findUnique({ where: { userId } })
    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

    const existing = await prisma.product.findFirst({
      where: { id, sellerId: seller.id, isDeleted: false },
    })
    if (!existing) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })

    // Process Hybrid Payload (JSON or FormData)
    const result = await processHybridProductRequest(request)
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    const body = result.data

    const updateData: Record<string, any> = {}
    if (body.name !== undefined) {
      updateData.name = body.name.trim()
      updateData.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    }
    if (body.description !== undefined) updateData.description = body.description
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId
    if (body.subcategoryId !== undefined) {
      if (body.subcategoryId) {
        const catId = body.categoryId ?? existing.categoryId
        const sub = await prisma.subcategory.findFirst({
          where: { id: body.subcategoryId, categoryId: catId },
        })
        if (!sub) return NextResponse.json({ success: false, error: "Subcategory does not belong to selected category" }, { status: 400 })
      }
      updateData.subcategoryId = body.subcategoryId || null
    }
    if (body.images !== undefined) updateData.images = Array.isArray(body.images) ? body.images : existing.images
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive
    if (typeof body.condition === "string") {
      const c = body.condition.toUpperCase()
      updateData.condition = (c === "USED") ? "USED" : "NEW"
    }
    if (body.deliveryChargePerKm !== undefined) updateData.deliveryChargePerKm = Number(body.deliveryChargePerKm || 0)

    // Handle Variants (Mirroring web logic: Recreate all)
    if (Array.isArray(body.variants)) {
      if (body.variants.length === 0) return NextResponse.json({ success: false, error: "At least one variant is required" }, { status: 400 })

      await prisma.productVariant.deleteMany({ where: { productId: id } })

      for (const v of body.variants) {
        const vName = typeof v?.name === "string" ? v.name.trim() : "Variant"
        const vPrice = Number(v?.price ?? 0)
        const vStock = Number(v?.stock ?? 0)
        const vDiscount = Math.round(Number(v?.discount ?? 0) * 100) / 100

        if (isNaN(vPrice) || vPrice <= 0 || isNaN(vStock) || vStock < 0) {
          return NextResponse.json({ success: false, error: "Each variant must have valid price and stock" }, { status: 400 })
        }

        const vReturnType = v?.returnType === "RETURNABLE" ? "RETURNABLE" : "NON_RETURNABLE"
        const vReturnDays = typeof v?.returnDays === "number" ? Math.floor(v.returnDays) : null

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
            attributes: (v?.attributes && typeof v.attributes === "object") ? v.attributes : {},
            specification: typeof v?.specification === "string" ? v.specification : null,
            details: typeof v?.details === "string" ? v.details : null,
            returnType: vReturnType,
            returnDays: vReturnDays,
            replacementAllowed: v?.replacementAllowed === true,
          },
        })
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData as any,
      include: { category: true, subcategory: true, variants: true },
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error("Mobile update product error:", error)
    return NextResponse.json({ success: false, error: "Failed to update product" }, { status: 500 })
  }
}

/**
 * DELETE /mobileapi/product-seller/product/[id]
 * Soft-delete a single product.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const { id } = await params

  try {
    const seller = await prisma.seller.findUnique({ where: { userId } })
    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

    const product = await prisma.product.findFirst({
      where: { id, sellerId: seller.id, isDeleted: false },
    })
    if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 })

    const deletedSlug = `${product.slug}-deleted-${Date.now()}`
    await prisma.product.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false,
        slug: deletedSlug
      }
    })

    return NextResponse.json({ success: true, message: "Product deleted successfully" })
  } catch (error) {
    console.error("Mobile delete product error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
