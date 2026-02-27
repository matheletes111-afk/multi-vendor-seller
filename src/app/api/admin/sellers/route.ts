import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

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

    const [sellers, totalCount] = await Promise.all([
      prisma.seller.findMany({
        skip,
        take,
        include: {
          user: true,
          store: true,
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
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.seller.count(),
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
