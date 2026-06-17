import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../../_helpers/seller-auth"
import { processHybridServiceRequest } from "../../../_helpers/service-upload"
import { sanitizeInput } from "@/lib/html-sanitization"

export const dynamic = 'force-dynamic'

/**
 * GET /mobileapi/service-seller/service/[id]
 * Get single service details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const { id } = await params

  try {
    const seller = await prisma.seller.findUnique({ where: { userId } })
    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

    const service = await prisma.service.findFirst({
      where: { id, sellerId: seller.id, isDeleted: false },
      include: {
        serviceCategory: { select: { id: true, name: true, slug: true } },
        slots: { take: 10, orderBy: { startTime: 'asc' } },
        packages: true,
        _count: { select: { orderItems: true, reviews: true } }
      },
    })

    if (!service) return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })

    return NextResponse.json({ success: true, data: service })
  } catch (error) {
    console.error("Mobile get service error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /mobileapi/service-seller/service/[id]
 * Update an existing service. Supports Hybrid Payloads.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const { id } = await params

  try {
    const seller = await prisma.seller.findUnique({ where: { userId } })
    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

    const existing = await prisma.service.findFirst({
      where: { id, sellerId: seller.id, isDeleted: false },
    })
    if (!existing) return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })

    // Process Hybrid Payload
    const result = await processHybridServiceRequest(request)
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    const body = result.data

    const updateData: Record<string, any> = {}
    if (body.name !== undefined) {
      const cleanName = sanitizeInput(body.name)
      updateData.name = cleanName
      updateData.slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    }
    if (body.description !== undefined) updateData.description = typeof body.description === "string" ? sanitizeInput(body.description) : body.description
    if (body.serviceCategoryId !== undefined) updateData.serviceCategoryId = body.serviceCategoryId
    if (body.serviceType !== undefined) updateData.serviceType = body.serviceType
    if (body.basePrice !== undefined) updateData.basePrice = body.basePrice
    if (body.discount !== undefined) updateData.discount = Math.round((Number(body.discount) || 0) * 100) / 100
    if (body.hasGst !== undefined) updateData.hasGst = body.hasGst
    if (body.duration !== undefined) updateData.duration = body.duration
    if (body.weeklyAvailability !== undefined) updateData.weeklyAvailability = body.weeklyAvailability
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive
    if (body.images !== undefined) updateData.images = body.images
    if (body.galleryImages !== undefined) updateData.galleryImages = body.galleryImages

    const service = await prisma.service.update({
      where: { id },
      data: updateData as any,
      include: { serviceCategory: true, slots: true, packages: true },
    })

    return NextResponse.json({ success: true, data: service })
  } catch (error: any) {
    if (error.code === "P2002") return NextResponse.json({ success: false, error: "Service with this name already exists" }, { status: 400 })
    console.error("Mobile update service error:", error)
    return NextResponse.json({ success: false, error: "Failed to update service" }, { status: 500 })
  }
}

/**
 * DELETE /mobileapi/service-seller/service/[id]
 * Soft-delete a single service.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_SERVICE)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const userId = authStatus.userId
  const { id } = await params

  try {
    const seller = await prisma.seller.findUnique({ where: { userId } })
    if (!seller) return NextResponse.json({ success: false, error: "Seller not found" }, { status: 404 })

    const service = await prisma.service.findFirst({
      where: { id, sellerId: seller.id, isDeleted: false },
    })
    if (!service) return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })

    const deletedSlug = `${service.slug}-deleted-${Date.now()}`
    await prisma.service.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false,
        slug: deletedSlug
      }
    })

    return NextResponse.json({ success: true, message: "Service deleted successfully" })
  } catch (error) {
    console.error("Mobile delete service error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
