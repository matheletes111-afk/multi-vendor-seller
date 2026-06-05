import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServiceDisplayImageUrls } from "@/lib/service-images"

export const dynamic = "force-dynamic"

type ServiceItem = {
  id: string
  serviceCategoryId: string
  serviceCategory: { id: string; name: string; slug: string }
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

type SuccessResponse = {
  success: true
  message: string
  data: { services: ServiceItem[]; total: number }
}

type ErrorResponse = { success: false; error: string }

/** GET /mobileapi/services/all — list all services (public). */
export async function GET(request: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") !== "false" // default true
    const limitRaw = searchParams.get("limit")
    const limit = limitRaw ? Math.max(1, Math.min(200, parseInt(limitRaw, 10) || 0)) : 50
    const featuredOnly = searchParams.get("featuredOnly") === "true"

    const where = {
      isDeleted: false,
      ...(activeOnly ? { isActive: true } : {}),
      ...(featuredOnly ? { isFeatured: true } : {}),
      seller: {
        isApproved: true,
        isSuspended: false,
      }
    }

    const services = await prisma.service.findMany({
      where,
      take: limit,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        serviceCategoryId: true,
        serviceCategory: { select: { id: true, name: true, slug: true } },
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

    const total = await prisma.service.count({ where })

    return NextResponse.json({
      success: true,
      message: "Services fetched successfully",
      data: { services: mapped, total },
    })
  } catch (error) {
    console.error("Mobile services all API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

