import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { DeliveryAssignmentStatus, Prisma } from "@prisma/client"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "RIDER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rider = await prisma.rider.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!rider) {
      return NextResponse.json({ error: "Rider profile not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const tab = (searchParams.get("tab") || "active").toLowerCase() // active, offered, completed, cancelled, all
    const specificStatus = searchParams.get("status") // specific DeliveryAssignmentStatus or ALL
    const search = searchParams.get("search")?.trim() || ""
    const period = searchParams.get("period") || "all" // all, today, yesterday, week, month, custom
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const paymentMethod = searchParams.get("paymentMethod") || "ALL" // ALL, COD, PREPAID
    const paymentStatus = searchParams.get("paymentStatus") || "ALL" // ALL, PAID, PENDING, FAILED
    const city = searchParams.get("city") || "ALL"
    const sortBy = searchParams.get("sortBy") || "newest" // newest, oldest, earning_desc, distance_desc, distance_asc

    // 1. Build Tab & Status Filters
    const activeStatuses: DeliveryAssignmentStatus[] = [
      DeliveryAssignmentStatus.ACCEPTED,
      DeliveryAssignmentStatus.AT_PICKUP,
      DeliveryAssignmentStatus.PICKED_UP,
      DeliveryAssignmentStatus.OUT_FOR_DELIVERY,
    ]
    const offeredStatuses: DeliveryAssignmentStatus[] = [DeliveryAssignmentStatus.OFFERED]
    const completedStatuses: DeliveryAssignmentStatus[] = [DeliveryAssignmentStatus.DELIVERED]
    const cancelledStatuses: DeliveryAssignmentStatus[] = [
      DeliveryAssignmentStatus.REJECTED,
      DeliveryAssignmentStatus.TIMED_OUT,
      DeliveryAssignmentStatus.CANCELLED_BY_RIDER,
      DeliveryAssignmentStatus.REASSIGNED_BY_ADMIN,
    ]

    let statusConstraint: Prisma.EnumDeliveryAssignmentStatusFilter | undefined = undefined

    if (specificStatus && specificStatus !== "ALL") {
      statusConstraint = { equals: specificStatus as DeliveryAssignmentStatus }
    } else if (tab === "offered") {
      statusConstraint = { in: offeredStatuses }
    } else if (tab === "active") {
      statusConstraint = { in: activeStatuses }
    } else if (tab === "completed") {
      statusConstraint = { in: completedStatuses }
    } else if (tab === "cancelled") {
      statusConstraint = { in: cancelledStatuses }
    }

    // 2. Build Date Filter
    const now = new Date()
    let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined

    if (period === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      dateFilter = { gte: start }
    } else if (period === "yesterday") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999)
      dateFilter = { gte: start, lte: end }
    } else if (period === "week") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      dateFilter = { gte: start }
    } else if (period === "month") {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      dateFilter = { gte: start }
    } else if (startDate || endDate) {
      dateFilter = {}
      if (startDate) {
        const s = new Date(startDate)
        if (!isNaN(s.getTime())) dateFilter.gte = s
      }
      if (endDate) {
        const e = new Date(endDate)
        if (!isNaN(e.getTime())) {
          e.setHours(23, 59, 59, 999)
          dateFilter.lte = e
        }
      }
    }

    // 3. Build Nested Order Constraints
    const orderConstraints: Prisma.OrderWhereInput = {}

    if (paymentMethod && paymentMethod !== "ALL") {
      if (paymentMethod === "COD") {
        orderConstraints.paymentMethod = { equals: "COD", mode: "insensitive" }
      } else if (paymentMethod === "PREPAID" || paymentMethod === "ONLINE") {
        orderConstraints.paymentMethod = { not: "COD" }
      }
    }

    if (paymentStatus && paymentStatus !== "ALL") {
      orderConstraints.paymentStatus = paymentStatus as any
    }

    if (city && city !== "ALL") {
      orderConstraints.shippingCity = { equals: city, mode: "insensitive" }
    }

    // 4. Assemble Base WHERE Query
    const where: Prisma.RiderDeliveryAssignmentWhereInput = {
      riderId: rider.id,
      ...(statusConstraint ? { status: statusConstraint } : {}),
      ...(dateFilter && (dateFilter.gte || dateFilter.lte) ? { offeredAt: dateFilter } : {}),
      ...(Object.keys(orderConstraints).length > 0 ? { order: orderConstraints } : {}),
    }

    // 5. Build Search Constraint
    if (search) {
      where.OR = [
        { order: { orderNumber: { contains: search, mode: "insensitive" } } },
        { order: { shippingFullName: { contains: search, mode: "insensitive" } } },
        { order: { shippingPhone: { contains: search, mode: "insensitive" } } },
        { order: { shippingCity: { contains: search, mode: "insensitive" } } },
        { order: { shippingAddressLine1: { contains: search, mode: "insensitive" } } },
        { order: { customer: { name: { contains: search, mode: "insensitive" } } } },
        { order: { customer: { phone: { contains: search, mode: "insensitive" } } } },
        { seller: { store: { name: { contains: search, mode: "insensitive" } } } },
        { seller: { businessInfo: { businessName: { contains: search, mode: "insensitive" } } } },
        { deliveryOtp: { contains: search, mode: "insensitive" } },
      ]
    }

    // 6. Sorting
    let orderBy: Prisma.RiderDeliveryAssignmentOrderByWithRelationInput = { offeredAt: "desc" }
    if (sortBy === "oldest") {
      orderBy = { offeredAt: "asc" }
    } else if (sortBy === "distance_desc") {
      orderBy = { distanceKm: "desc" }
    } else if (sortBy === "distance_asc") {
      orderBy = { distanceKm: "asc" }
    }

    // 7. Parallel fetch: tab counts for rider + filtered assignments
    const [statusCounts, assignments] = await Promise.all([
      prisma.riderDeliveryAssignment.groupBy({
        by: ["status"],
        where: { riderId: rider.id },
        _count: { _all: true },
      }),
      prisma.riderDeliveryAssignment.findMany({
        where,
        include: {
          seller: {
            include: {
              store: true,
              businessInfo: true,
              user: { select: { name: true, phone: true } },
            },
          },
          order: {
            include: {
              seller: {
                include: {
                  store: true,
                  businessInfo: true,
                  user: { select: { name: true, phone: true } },
                },
              },
              customer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  phoneCountryCode: true,
                  image: true,
                },
              },
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      images: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy,
      }),
    ])

    // 8. Compute Tab Counters
    let activeCount = 0
    let offeredCount = 0
    let completedCount = 0
    let cancelledCount = 0
    let allCount = 0

    for (const item of statusCounts) {
      const c = item._count._all
      allCount += c
      if (activeStatuses.includes(item.status)) activeCount += c
      else if (offeredStatuses.includes(item.status)) offeredCount += c
      else if (completedStatuses.includes(item.status)) completedCount += c
      else if (cancelledStatuses.includes(item.status)) cancelledCount += c
    }

    // 9. Annotate each assignment with delivery earnings and scope seller/items
    let annotatedAssignments = assignments.map((a) => {
      const assignedSeller = a.seller || a.order?.seller || null
      const assignedItems = (a.order?.items || []).filter(
        (item) => !a.sellerId || item.sellerId === a.sellerId
      )
      const earningForThisDelivery =
        assignedItems.reduce(
          (sum, item) => sum + (Number((item as any).shippingAmount) || 0),
          0
        ) || Number(a.order?.shipping || 0)

      return {
        ...a,
        earningForThisDelivery,
        order: a.order
          ? {
              ...a.order,
              seller: assignedSeller,
              items: assignedItems,
            }
          : null,
      }
    })

    // In-memory sort if earning_desc was chosen
    if (sortBy === "earning_desc") {
      annotatedAssignments.sort(
        (a, b) => (b.earningForThisDelivery || 0) - (a.earningForThisDelivery || 0)
      )
    }

    const totalEarnings = annotatedAssignments.reduce(
      (sum, a) => sum + (Number(a.earningForThisDelivery) || 0),
      0
    )

    return NextResponse.json({
      success: true,
      tab,
      counts: {
        all: allCount,
        active: activeCount,
        offered: offeredCount,
        completed: completedCount,
        cancelled: cancelledCount,
      },
      filteredCount: annotatedAssignments.length,
      totalEarnings,
      assignments: annotatedAssignments,
    })
  } catch (error: any) {
    console.error("[API] Rider orders fetch error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch orders" },
      { status: 500 }
    )
  }
}
