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
    const categoryId = searchParams.get("categoryId")?.trim()
    const status = searchParams.get("status")?.trim() // "active", "inactive", "all"
    const condition = searchParams.get("condition")?.trim() // "NEW", "USED", "all"
    const startDate = searchParams.get("startDate")?.trim()
    const endDate = searchParams.get("endDate")?.trim()

    const where: Prisma.ProductWhereInput = {
      isDeleted: false,
    }

    if (sellerId && sellerId !== "all" && sellerId !== "ALL_SELLERS") {
      where.sellerId = sellerId
    }

    if (categoryId && categoryId !== "all" && categoryId !== "ALL_CATS") {
      where.categoryId = categoryId
    }

    if (status && status !== "all") {
      where.isActive = status === "active"
    }

    if (condition && condition !== "all") {
      where.condition = condition as any
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

    const [products, totalCount, productSellers, categories] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        include: {
          category: true,
          subcategory: true,
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
          variants: true,
          _count: {
            select: {
              orderItems: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
      prisma.seller.findMany({
        where: { type: "PRODUCT" },
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
      prisma.category.findMany({
        include: { subcategories: true },
        orderBy: { name: "asc" },
      }),
    ])

    const totalPages = Math.ceil(totalCount / perPage)

    return NextResponse.json({
      products,
      productSellers,
      categories,
      totalCount,
      totalPages,
      page,
      perPage,
    })
  } catch (error) {
    console.error("Error fetching admin products:", error)
    return NextResponse.json(
      { error: "Failed to fetch products" },
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

    // Soft delete each product
    for (const id of ids) {
      const product = await prisma.product.findUnique({ where: { id } })
      if (product) {
        const deletedSlug = `${product.slug}-deleted-${Date.now()}`
        await prisma.product.update({
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
    console.error("Error bulk deleting products:", error)
    return NextResponse.json(
      { error: "Failed to bulk delete products" },
      { status: 500 }
    )
  }
}
