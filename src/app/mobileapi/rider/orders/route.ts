import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "../../_helpers/rider-auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const authResult = await getMobileRiderAuth(request)
  if (!authResult.ok) {
    if (authResult.error === "forbidden") {
      return NextResponse.json({ success: false, error: "Access denied. Riders only." }, { status: 403 })
    }
    if (authResult.error === "suspended") {
      return NextResponse.json({ success: false, error: "Rider account is suspended." }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
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
        riderId: authResult.rider.id,
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
                productVariant: {
                  select: {
                    id: true,
                    name: true,
                    weight: true,
                    height: true,
                    width: true,
                    depth: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { offeredAt: "desc" },
    })

    const mappedAssignments = assignments.map((a) => {
      const filteredItems = a.order.items.filter(
        (item) => !a.sellerId || item.sellerId === a.sellerId
      )
      const itemsShippingSum = filteredItems.reduce(
        (sum, item) => sum + (Number(item.shippingAmount) || 0),
        0
      )
      const earningForThisDelivery = itemsShippingSum > 0 ? itemsShippingSum : Number(a.order?.shipping || 0)

      return {
        ...a,
        earningForThisDelivery,
        order: {
          ...a.order,
          seller: a.seller || a.order.seller,
          items: filteredItems,
        },
      }
    })

    return NextResponse.json({
      success: true,
      tab,
      count: mappedAssignments.length,
      data: mappedAssignments,
    })
  } catch (error: any) {
    console.error("[Mobile API] Rider orders fetch error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch orders" },
      { status: 500 }
    )
  }
}
