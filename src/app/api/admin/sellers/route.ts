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

    const tab = searchParams.get("tab") ?? "all"
    let where: Prisma.SellerWhereInput = {}
    if (tab === "pending") where = { isApproved: false }
    else if (tab === "approved") where = { isApproved: true, isSuspended: false }
    else if (tab === "suspended") where = { isSuspended: true }

    const [sellers, totalCount] = await Promise.all([
      prisma.seller.findMany({
        where,
        skip,
        take,
        include: {
          user: true,
          store: true,
          businessInfo: true,
          kyc: true,
          bankDetails: true,
          selectedCategories: true,
          selectedServiceCategories: true,
          subscription: {
            include: { plan: true },
          },
          _count: {
            select: {
              products: true,
              services: true,
              orders: true,
            },
          },
        } as any,
        orderBy: { createdAt: "desc" },
      }),
      prisma.seller.count({ where }),
    ])

    const totalPages = Math.ceil(totalCount / perPage)
    return NextResponse.json({
      sellers,
      totalCount,
      totalPages,
      page,
      perPage,
    })
  } catch (error) {
    console.error("Error fetching sellers:", error)
    return NextResponse.json(
      { error: "Failed to fetch sellers" },
      { status: 500 }
    )
  }
}
