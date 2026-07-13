import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../_helpers/seller-auth"
import { checkProductLimit } from "@/lib/subscriptions"
import { processHybridProductRequest } from "../../_helpers/product-upload"
import {
  parseVariantInput,
  sellerHasSelectedCategory,
  slugFromName,
  type NormalizedVariant,
  type VariantInput,
} from "@/lib/product-seller-product-payload"

export const dynamic = 'force-dynamic'

/**
 * GET /mobileapi/product-seller/product
 * List products with filters and pagination.
 */
export async function GET(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.seller.findUnique({
      where: { userId },
    })

    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1", 10)
    const perPage = parseInt(searchParams.get("perPage") || "10", 10)
    const skip = (page - 1) * perPage
    const take = perPage

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

    if (categoryId) where.categoryId = categoryId
    if (subcategoryId) where.subcategoryId = subcategoryId

    if (minPrice || maxPrice) {
      where.variants = { some: {} }
      if (minPrice) where.variants.some.price = { ...where.variants.some.price, gte: parseFloat(minPrice) }
      if (maxPrice) where.variants.some.price = { ...where.variants.some.price, lte: parseFloat(maxPrice) }
    }

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          subcategory: { select: { id: true, name: true, slug: true } },
          variants: true,
          _count: {
            select: { orderItems: true, reviews: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ])

    const totalPages = Math.ceil(totalCount / perPage) || 1

    return NextResponse.json({
      success: true,
      data: {
        products,
        pagination: { totalCount, totalPages, page, perPage }
      }
    })
  } catch (error) {
    console.error("Mobile list products error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /mobileapi/product-seller/product
 * Create a new product. Supports JSON or FormData (for files).
 */
export async function POST(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.seller.findUnique({ where: { userId } })
    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })
    if (!seller.isApproved) return NextResponse.json({ success: false, error: "Your seller account is pending approval." }, { status: 403 })
    if (seller.isSuspended) return NextResponse.json({ success: false, error: "Your seller account has been suspended." }, { status: 403 })
    
    const limitCheck = await checkProductLimit(seller.id)
    if (!limitCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: `Product limit reached. Plan allows ${limitCheck.limit}. Upgrade to add more.`,
      }, { status: 403 })
    }

    // Process Hybrid Payload (JSON or FormData)
    const result = await processHybridProductRequest(request)
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    const body = result.data

    const name = typeof body.name === "string" ? body.name.trim() : ""
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : ""
    
    if (!name || !categoryId) return NextResponse.json({ success: false, error: "Name and category are required" }, { status: 400 })
    
    const allowedCat = await sellerHasSelectedCategory(seller.id, categoryId)
    if (!allowedCat) return NextResponse.json({ success: false, error: "Category is not in your allowed list" }, { status: 400 })
    
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    })
    if (!category) return NextResponse.json({ success: false, error: "Category not found" }, { status: 400 })
    const isWeightMandatory = category.weightMandatory

    const subcategoryId = typeof body.subcategoryId === "string" ? body.subcategoryId || null : null
    if (subcategoryId) {
      const sub = await prisma.subcategory.findFirst({
        where: { id: subcategoryId, categoryId },
      })
      if (!sub) return NextResponse.json({ success: false, error: "Subcategory does not belong to selected category" }, { status: 400 })
    }
    
    const variantsRaw = Array.isArray(body.variants) ? body.variants : []
    if (variantsRaw.length === 0) return NextResponse.json({ success: false, error: "At least one variant is required" }, { status: 400 })
    
    const slug = slugFromName(name)
    const imagesData = Array.isArray(body.images) ? body.images : []
    const variants: NormalizedVariant[] = []
    
    for (let i = 0; i < variantsRaw.length; i++) {
      const parsed = parseVariantInput(variantsRaw[i] as VariantInput, i)
      if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
      if (isWeightMandatory && (parsed.variant.weight === null || parsed.variant.weight <= 0)) {
        return NextResponse.json({ success: false, error: `Variant ${i + 1}: weight is mandatory for category ${category.name}` }, { status: 400 })
      }
      variants.push(parsed.variant)
    }
    
    const conditionInput = typeof body.condition === "string" ? body.condition.toUpperCase() : "NEW"
    const condition = (conditionInput === "USED") ? "USED" : "NEW"

    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId,
        subcategoryId,
        name,
        slug,
        description: body.description ?? null,
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

    return NextResponse.json({ success: true, data: product })
  } catch (error: any) {
    if (error.code === "P2002") return NextResponse.json({ success: false, error: "Product with this name already exists" }, { status: 400 })
    console.error("Mobile create product error:", error)
    return NextResponse.json({ success: false, error: "Failed to create product" }, { status: 500 })
  }
}

/**
 * DELETE /mobileapi/product-seller/product
 * Bulk soft-delete products.
 */
export async function DELETE(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.seller.findUnique({ where: { userId } })
    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const { ids } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: "No product IDs provided" }, { status: 400 })
    }

    const result = await prisma.product.updateMany({
      where: {
        id: { in: ids },
        sellerId: seller.id,
        isDeleted: false,
      },
      data: { isDeleted: true },
    })

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.count} product(s)`,
      data: { count: result.count }
    })
  } catch (error) {
    console.error("Mobile bulk delete error:", error)
    return NextResponse.json({ success: false, error: "Failed to delete products" }, { status: 500 })
  }
}
