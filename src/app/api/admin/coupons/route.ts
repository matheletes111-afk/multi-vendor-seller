import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import { sanitizeInput } from "@/lib/html-sanitization"

// GET coupons with pagination
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

    const [coupons, totalCount] = await Promise.all([
      prisma.coupon.findMany({
        skip,
        take,
        include: {
          usages: {
            select: { id: true }
          }
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.coupon.count(),
    ])

    const totalPages = Math.ceil(totalCount / perPage)
    return NextResponse.json({
      coupons,
      totalCount,
      totalPages,
      page,
      perPage,
    })
  } catch (error: any) {
    console.error("Error fetching coupons:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch coupons" },
      { status: 500 }
    )
  }
}

// POST create new coupon
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const code = sanitizeInput(body.code || "").trim().toUpperCase()
    const discountType = sanitizeInput(body.discountType || "PERCENTAGE") // PERCENTAGE or FIXED
    const discountValue = parseFloat(body.discountValue)
    const type = sanitizeInput(body.type || "PRODUCT") // PRODUCT, SERVICE, HOTEL, FOOD
    const categoryId = body.categoryId ? sanitizeInput(body.categoryId).trim() : null
    const customerCount = body.customerCount ? parseInt(body.customerCount) : null
    const maxUsesPerCustomer = body.maxUsesPerCustomer ? parseInt(body.maxUsesPerCustomer) : 1
    const minOrderValue = body.minOrderValue ? parseFloat(body.minOrderValue) : 0
    const startDate = new Date(body.startDate)
    const endDate = new Date(body.endDate)
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true

    if (!code) {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 })
    }
    if (isNaN(discountValue) || discountValue <= 0) {
      return NextResponse.json({ error: "Discount value must be a positive number" }, { status: 400 })
    }
    if (!["PERCENTAGE", "FIXED"].includes(discountType)) {
      return NextResponse.json({ error: "Invalid discount type" }, { status: 400 })
    }
    if (!["PRODUCT", "SERVICE", "HOTEL", "FOOD"].includes(type)) {
      return NextResponse.json({ error: "Invalid coupon type" }, { status: 400 })
    }
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid start or end date" }, { status: 400 })
    }
    if (startDate >= endDate) {
      return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 })
    }

    // Check uniqueness of coupon code
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code }
    })
    if (existingCoupon) {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 400 })
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        discountType,
        discountValue,
        type,
        categoryId,
        customerCount,
        maxUsesPerCustomer,
        minOrderValue,
        startDate,
        endDate,
        isActive
      }
    })

    return NextResponse.json({ message: "Coupon created successfully", coupon }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating coupon:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create coupon" },
      { status: 500 }
    )
  }
}
