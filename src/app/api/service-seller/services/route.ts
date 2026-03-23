import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isServiceSeller } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user || !isServiceSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  if (!seller) {
    return NextResponse.json({
      services: [],
      totalCount: 0,
      totalPages: 1,
      page: 1,
      perPage: 10,
    })
  }

  const { searchParams } = new URL(request.url)
  const { skip, take, page, perPage } = getPaginationFromSearchParams({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
  })

  const where = { sellerId: seller.id }

  const [services, totalCount] = await Promise.all([
    prisma.service.findMany({
      where,
      skip,
      take,
      include: {
        serviceCategory: true,
        slots: true,
        packages: true,
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
  ])

  const totalPages = Math.ceil(totalCount / perPage) || 1

  return NextResponse.json({
    services,
    totalCount,
    totalPages,
    page,
    perPage,
  })
}
