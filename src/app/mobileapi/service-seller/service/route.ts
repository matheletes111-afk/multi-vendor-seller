import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../_helpers/seller-auth"
import { checkServiceLimit } from "@/lib/subscriptions"
import { processHybridServiceRequest } from "../../_helpers/service-upload"
import { sanitizeInput } from "@/lib/html-sanitization"

export const dynamic = 'force-dynamic'

/**
 * GET /mobileapi/service-seller/service
 * List services with filters and pagination.
 */
export async function GET(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.seller.findUnique({ where: { userId } })
    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1", 10)
    const perPage = parseInt(searchParams.get("perPage") || "10", 10)
    const skip = (page - 1) * perPage
    const take = perPage

    // Filters
    const q = searchParams.get("q") || ""
    const categoryId = searchParams.get("categoryId") || ""
    const serviceType = searchParams.get("serviceType") || ""

    const where: any = { 
      sellerId: seller.id, 
      isDeleted: false 
    }

    if (q) {
      where.name = { contains: q, mode: "insensitive" }
    }
    
    if (categoryId) {
      where.serviceCategoryId = categoryId
    }

    if (serviceType) {
      where.serviceType = serviceType
    }

    const [services, totalCount] = await Promise.all([
      prisma.service.findMany({
        where,
        skip,
        take,
        include: {
          serviceCategory: { select: { id: true, name: true, slug: true } },
          slots: { take: 5 }, // Just a few slots for preview
          packages: true,
          _count: {
            select: { orderItems: true, reviews: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.service.count({ where }),
    ])

    const totalPages = Math.ceil(totalCount / perPage) || 1

    return NextResponse.json({
      success: true,
      data: {
        services,
        pagination: { totalCount, totalPages, page, perPage }
      }
    })
  } catch (error) {
    console.error("Mobile list services error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /mobileapi/service-seller/service
 * Create a new service. Supports Hybrid Payloads.
 */
export async function POST(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId

  try {
    const seller = await prisma.seller.findUnique({ 
        where: { userId },
        include: { selectedServiceCategories: true }
    })

    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })
    if (!seller.isApproved) return NextResponse.json({ success: false, error: "Your seller account is pending approval." }, { status: 403 })
    if (seller.isSuspended) return NextResponse.json({ success: false, error: "Your seller account has been suspended." }, { status: 403 })

    const limitCheck = await checkServiceLimit(seller.id)
    if (!limitCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: `Service limit reached. Plan allows ${limitCheck.limit}. Upgrade to add more.`,
      }, { status: 403 })
    }

    // Process Hybrid Payload
    const result = await processHybridServiceRequest(request)
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    const body = result.data

    const nameRaw = typeof body.name === "string" ? body.name.trim() : ""
    const name = sanitizeInput(nameRaw)
    const categoryId = typeof body.serviceCategoryId === "string" ? body.serviceCategoryId : ""
    const serviceType = body.serviceType === "FIXED_PRICE" ? "FIXED_PRICE" : "APPOINTMENT"
 
    if (!name || !categoryId) return NextResponse.json({ success: false, error: "Name and category are required" }, { status: 400 })
 
    // Check category ownership
    const hasCategory = seller.selectedServiceCategories.some(c => c.id === categoryId)
    if (!hasCategory) return NextResponse.json({ success: false, error: "Category not in your allowed list" }, { status: 400 })
 
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    const basePrice = typeof body.basePrice === "number" ? body.basePrice : null
    const discount = Math.round((Number(body.discount) || 0) * 100) / 100
    const duration = typeof body.duration === "number" ? body.duration : null
    const sanitizedDescription = typeof body.description === "string" ? sanitizeInput(body.description) : null
 
    const service = await prisma.service.create({
      data: {
        sellerId: seller.id,
        serviceCategoryId: categoryId,
        name,
        slug,
        description: sanitizedDescription,
        serviceType,
        basePrice,
        discount,
        hasGst: body.hasGst !== false,
        duration,
        weeklyAvailability: body.weeklyAvailability ?? undefined,
        images: Array.isArray(body.images) ? (body.images as object) : [],
        galleryImages: Array.isArray(body.galleryImages) ? (body.galleryImages as object) : [],
      } as any,
      include: { serviceCategory: true },
    })

    return NextResponse.json({ success: true, data: service })
  } catch (error: any) {
    if (error.code === "P2002") return NextResponse.json({ success: false, error: "Service with this name already exists" }, { status: 400 })
    console.error("Mobile create service error:", error)
    return NextResponse.json({ success: false, error: "Failed to create service" }, { status: 500 })
  }
}

/**
 * DELETE /mobileapi/service-seller/service
 * Bulk delete services.
 */
export async function DELETE(request: NextRequest) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
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
      return NextResponse.json({ success: false, error: "No service IDs provided" }, { status: 400 })
    }

    const result = await prisma.service.updateMany({
      where: {
        id: { in: ids },
        sellerId: seller.id,
        isDeleted: false,
      },
      data: { isDeleted: true },
    })

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.count} service(s)`,
      data: { count: result.count }
    })
  } catch (error) {
    console.error("Mobile bulk delete services error:", error)
    return NextResponse.json({ success: false, error: "Failed to delete services" }, { status: 500 })
  }
}
