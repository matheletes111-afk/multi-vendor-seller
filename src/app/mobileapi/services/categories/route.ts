import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type ServiceCategoryItem = {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  mobileIcon: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  servicesCount?: number
}

type SuccessResponse = {
  success: true
  message: string
  data: { categories: ServiceCategoryItem[]; total: number }
}

type ErrorResponse = { success: false; error: string }

/** GET /mobileapi/services/categories — list service categories (public). */
export async function GET(request: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url)
    const includeCounts = searchParams.get("includeCounts") === "true"
    const activeOnly = searchParams.get("activeOnly") !== "false" // default true
    const limitRaw = searchParams.get("limit")
    const limit = limitRaw ? Math.max(1, Math.min(200, parseInt(limitRaw, 10) || 0)) : undefined

    const where = activeOnly ? { isActive: true } : {}

    const categories = await prisma.serviceCategory.findMany({
      where,
      orderBy: { name: "asc" },
      ...(limit ? { take: limit } : {}),
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
        ...(includeCounts ? { _count: { select: { services: true } } } : {}),
      },
    })

    const result: ServiceCategoryItem[] = categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      mobileIcon: c.mobileIcon,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      ...(includeCounts ? { servicesCount: c._count?.services ?? 0 } : {}),
    }))

    return NextResponse.json({
      success: true,
      message: "Service categories fetched successfully",
      data: { categories: result, total: result.length },
    })
  } catch (error) {
    console.error("Mobile service categories API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

