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
    const type = searchParams.get("type") // "PRODUCT" or "SERVICE"
    const status = searchParams.get("status") // "PENDING", "APPROVED", "SUSPENDED", "ONBOARDING"
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    let where: Prisma.SellerWhereInput = {}

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }
    
    // Status Logic (supports both legacy 'tab' and new 'status' select)
    const effectiveStatus = status && status !== "all" ? status.toLowerCase() : tab
    if (effectiveStatus === "pending") {
       where = { ...where, isApproved: false, status: { not: "REJECTED" } }
    } else if (effectiveStatus === "approved") {
       where = { ...where, isApproved: true, isSuspended: false }
    } else if (effectiveStatus === "suspended") {
       where = { ...where, isSuspended: true }
    } else if (effectiveStatus === "onboarding") {
       where = { ...where, onboardingCompleted: false }
    }

    if (type && type !== "all" && type !== "ALL") {
       where = { ...where, type: type as any }
    }

    if (search) {
       where = {
          ...where,
          OR: [
             { user: { name: { contains: search, mode: "insensitive" } } },
             { store: { name: { contains: search, mode: "insensitive" } } },
             { businessInfo: { businessName: { contains: search, mode: "insensitive" } } },
             { user: { email: { contains: search, mode: "insensitive" } } },
          ]
       }
    }

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
          agreement: true,
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
