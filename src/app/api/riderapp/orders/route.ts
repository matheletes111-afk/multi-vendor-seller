import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
    const tab = searchParams.get("tab") || "active" // active, offered, completed, all

    let statusFilter: any = undefined
    if (tab === "offered") {
      statusFilter = { in: ["OFFERED"] }
    } else if (tab === "active") {
      statusFilter = { in: ["ACCEPTED", "AT_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] }
    } else if (tab === "completed") {
      statusFilter = { in: ["DELIVERED"] }
    }

    const assignments = await prisma.riderDeliveryAssignment.findMany({
      where: {
        riderId: rider.id,
        status: statusFilter,
      },
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
      orderBy: { offeredAt: "desc" },
    })

    // Annotate each assignment with the rider's earning for that delivery and scope seller/items
    const annotatedAssignments = assignments.map((a) => {
      const assignedSeller = a.seller || a.order?.seller || null
      const assignedItems = (a.order?.items || []).filter(
        (item) => !a.sellerId || item.sellerId === a.sellerId
      )
      const earningForThisDelivery = assignedItems.reduce(
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

    return NextResponse.json({
      success: true,
      tab,
      count: annotatedAssignments.length,
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
