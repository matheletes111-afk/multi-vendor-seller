import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import type { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { skip, take, page, perPage } = getPaginationFromSearchParams({
      page: searchParams.get("page") ?? undefined,
      perPage: searchParams.get("perPage") ?? undefined,
    })

    const search = searchParams.get("search")?.trim() || searchParams.get("q")?.trim()
    const sellerId = searchParams.get("sellerId")?.trim()
    const serviceCategoryId = searchParams.get("serviceCategoryId")?.trim()
    const status = searchParams.get("status")?.trim() // "active", "inactive", "all"
    const startDate = searchParams.get("startDate")?.trim()
    const endDate = searchParams.get("endDate")?.trim()

    const where: Prisma.ServiceWhereInput = {
      isDeleted: false,
    }

    if (sellerId && sellerId !== "all" && sellerId !== "ALL_SELLERS") {
      where.sellerId = sellerId
    }

    if (serviceCategoryId && serviceCategoryId !== "all" && serviceCategoryId !== "ALL_CATS") {
      where.serviceCategoryId = serviceCategoryId
    }

    if (status && status !== "all") {
      where.isActive = status === "active"
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const [services, totalCount, serviceSellers, serviceCategories] = await Promise.all([
      prisma.service.findMany({
        where,
        skip,
        take,
        include: {
          serviceCategory: true,
          seller: {
            include: {
              store: true,
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          packages: true,
          slots: true,
          _count: {
            select: {
              orderItems: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.service.count({ where }),
      prisma.seller.findMany({
        where: { type: "SERVICE" },
        include: {
          store: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.serviceCategory.findMany({
        orderBy: { name: "asc" },
      }),
    ])

    const totalPages = Math.ceil(totalCount / perPage)

    return NextResponse.json({
      services,
      serviceSellers,
      serviceCategories,
      totalCount,
      totalPages,
      page,
      perPage,
    })
  } catch (error) {
    console.error("Error fetching admin services:", error)
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { ids } = body as { ids?: string[] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 })
    }

    // Soft delete each service
    for (const id of ids) {
      const service = await prisma.service.findUnique({ where: { id } })
      if (service) {
        const deletedSlug = `${service.slug}-deleted-${Date.now()}`
        await prisma.service.update({
          where: { id },
          data: {
            isDeleted: true,
            isActive: false,
            slug: deletedSlug,
          },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error bulk deleting services:", error)
    return NextResponse.json(
      { error: "Failed to bulk delete services" },
      { status: 500 }
    )
  }
}
