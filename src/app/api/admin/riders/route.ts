import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { validatePhoneAndCountryCode } from "@/lib/phone-validation"
import { sendRiderWelcomeEmail } from "@/lib/email"
import { getPaginationFromSearchParams } from "@/lib/admin-pagination"
import { buildDateRangeFilter } from "@/lib/admin-date-filters"

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

    const search = searchParams.get("search")?.trim() || searchParams.get("q")?.trim() || ""
    const statusParam = (searchParams.get("status") || "ALL").toUpperCase()
    const zoneFilter = searchParams.get("zone")?.trim() || ""
    const locationFilter = searchParams.get("location")?.trim() || ""
    const timeframe = searchParams.get("timeframe")?.trim()
    const startDate = searchParams.get("startDate")?.trim()
    const endDate = searchParams.get("endDate")?.trim()

    // 1. Build date range filter
    const dateFilter = buildDateRangeFilter({
      timeframe,
      startDate,
      endDate,
    })

    // 2. Build where clause
    const where: any = {
      role: UserRole.RIDER,
      rider: { isNot: null },
    }

    if (dateFilter) {
      where.createdAt = dateFilter
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ]
    }

    if (statusParam && statusParam !== "ALL") {
      if (statusParam === "APPROVED") {
        where.rider = { ...where.rider, status: "APPROVED", isSuspended: false }
      } else if (statusParam === "SUSPENDED") {
        where.rider = { ...where.rider, OR: [{ isSuspended: true }, { status: "SUSPENDED" }] }
      } else if (statusParam === "PENDING") {
        where.rider = { ...where.rider, status: "PENDING", isSuspended: false }
      } else if (statusParam === "REJECTED") {
        where.rider = { ...where.rider, status: "REJECTED" }
      }
    }

    const hasCustomZoneOrLoc = Boolean(zoneFilter || locationFilter)

    let total = 0
    let paginatedRiders: any[] = []

    if (hasCustomZoneOrLoc) {
      // When zone/location filtering is requested, filter the full matching set to ensure accurate total and pages
      const allMatchingUsers = await prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          phone: true,
          phoneCountryCode: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
          rider: true,
        },
      })

      let filtered = allMatchingUsers
      if (zoneFilter) {
        filtered = filtered.filter((u) => {
          const zones = (u.rider?.selectedZones as string[]) || []
          return zones.includes(zoneFilter)
        })
      }

      if (locationFilter) {
        filtered = filtered.filter((u) => {
          const locs = (u.rider?.selectedLocations as string[]) || []
          return locs.some((l) => l.toLowerCase().includes(locationFilter.toLowerCase()))
        })
      }

      total = filtered.length
      paginatedRiders = filtered.slice(skip, skip + take)
    } else {
      const [countResult, dbUsers] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
            phoneCountryCode: true,
            isEmailVerified: true,
            createdAt: true,
            updatedAt: true,
            rider: true,
          },
        }),
      ])

      total = countResult
      paginatedRiders = dbUsers
    }

    return NextResponse.json({
      riders: paginatedRiders,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    })
  } catch (error) {
    console.error("Admin GET riders error:", error)
    return NextResponse.json(
      { error: "Failed to fetch riders list." },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, phone, phoneCountryCode } = body

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !phoneCountryCode?.trim()) {
      return NextResponse.json(
        { error: "Name, email, country code, and mobile number are required." },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()

    // Validate phone & country code
    const phoneValidation = validatePhoneAndCountryCode(phone, phoneCountryCode)
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: phoneValidation.error || "Invalid mobile number or country code." },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    })

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email address already exists." },
        { status: 400 }
      )
    }

    // Generate random 10-character password
    const temporaryPassword = crypto.randomBytes(5).toString("hex") + "!9A"
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10)

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        phone: phoneValidation.cleanedPhone,
        phoneCountryCode: phoneValidation.cleanedCountryCode,
        role: UserRole.RIDER,
        isEmailVerified: true, // Admin-created accounts are email pre-verified
        rider: {
          create: {
            isApproved: true,
            isSuspended: false,
            status: "APPROVED",
            onboardingCompleted: false,
            isFirstLogin: true,
          },
        },
      },
      include: { rider: true },
    })

    const origin = new URL(request.url).origin
    const loginUrl = `${origin}/riderapp/login`

    // Dispatch welcome email with credentials
    await sendRiderWelcomeEmail({
      to: cleanEmail,
      name: name.trim(),
      temporaryPassword,
      loginUrl,
    })

    return NextResponse.json({
      success: true,
      message: "Rider created successfully and welcome email sent!",
      user,
    })
  } catch (error) {
    console.error("Admin create rider error:", error)
    return NextResponse.json(
      { error: "Failed to create rider. Please try again." },
      { status: 500 }
    )
  }
}
