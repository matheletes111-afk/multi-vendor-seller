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
    const search = searchParams.get("search")?.trim()
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    let where: Prisma.HotelSellerWhereInput = {}

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }
    
    if (tab === "pending") {
       where = { ...where, isApproved: false, status: { not: "REJECTED" } }
    } else if (tab === "approved") {
       where = { ...where, isApproved: true, isSuspended: false }
    } else if (tab === "suspended") {
       where = { ...where, isSuspended: true }
    }

    if (search) {
       where = {
          ...where,
          OR: [
             { user: { name: { contains: search, mode: "insensitive" } } },
             { businessInfo: { businessName: { contains: search, mode: "insensitive" } } },
             { user: { email: { contains: search, mode: "insensitive" } } },
          ]
       }
    }

    const [sellers, totalCount] = await Promise.all([
      prisma.hotelSeller.findMany({
        where,
        skip,
        take,
        include: {
          user: true,
          businessInfo: true,
          kyc: true,
          bankDetails: true,
          agreement: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.hotelSeller.count({ where }),
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
    console.error("Error fetching hotel sellers:", error)
    return NextResponse.json({ error: "Failed to fetch sellers" }, { status: 500 })
  }
}
