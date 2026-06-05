import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServiceDisplayImageUrls } from "@/lib/service-images"

export const dynamic = "force-dynamic"

type ServiceItem = {
  id: string
  serviceCategoryId: string
  name: string
  slug: string
  description: string | null
  serviceType: string
  basePrice: number | null
  discount: number
  hasGst: boolean
  images: string[]
  isActive: boolean
  isFeatured: boolean
  duration: number | null
  createdAt: Date
  updatedAt: Date
  seller?: { store: { name: string } | null } | null
}

type ServiceCategoryDetail = {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  mobileIcon: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

type SuccessResponse = {
  success: true
  message: string
  data: { category: ServiceCategoryDetail; services: ServiceItem[]; totalServices: number }
}

type ErrorResponse = { success: false; error: string }

/** GET /mobileapi/services/categories/[id] — service category details + its services (public). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") !== "false" // default true
    const limitRaw = searchParams.get("limit")
    const limit = limitRaw ? Math.max(1, Math.min(200, parseInt(limitRaw, 10) || 0)) : 50

    const category = await prisma.serviceCategory.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        mobileIcon: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!category) {
      return NextResponse.json({ success: false, error: "Service category not found" }, { status: 404 })
    }

    const services = await prisma.service.findMany({
      where: {
        serviceCategoryId: id,
        ...(activeOnly ? { isActive: true } : {}),
        seller: {
          isApproved: true,
          isSuspended: false,
        }
      },
      take: limit,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        serviceCategoryId: true,
        name: true,
        slug: true,
        description: true,
        serviceType: true,
        basePrice: true,
        discount: true,
        hasGst: true,
        images: true,
        galleryImages: true,
        isActive: true,
        isFeatured: true,
        duration: true,
        createdAt: true,
        updatedAt: true,
        seller: { select: { store: { select: { name: true } } } },
      },
    })

    const mapped: ServiceItem[] = services.map((s) => ({
      ...s,
      images: getServiceDisplayImageUrls({ images: s.images, galleryImages: s.galleryImages }),
    }))

    const totalServices = await prisma.service.count({
      where: { 
        serviceCategoryId: id, 
        ...(activeOnly ? { isActive: true } : {}),
        seller: {
          isApproved: true,
          isSuspended: false,
        }
      },
    })

    return NextResponse.json({
      success: true,
      message: "Service category fetched successfully",
      data: { category, services: mapped, totalServices },
    })
  } catch (error) {
    console.error("Mobile service category detail API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

