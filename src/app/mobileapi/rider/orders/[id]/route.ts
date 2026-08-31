import { NextRequest, NextResponse } from "next/server"
import { getMobileRiderAuth } from "../../../_helpers/rider-auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params

    const assignment = await prisma.riderDeliveryAssignment.findFirst({
      where: {
        riderId: authResult.rider.id,
        OR: [{ id }, { orderId: id }],
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
    })

    if (!assignment) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 })
    }

    // Isolate items to only this assigned seller's package
    const filteredItems = assignment.order.items.filter(
      (item) => !assignment.sellerId || item.sellerId === assignment.sellerId
    )
    const itemsShippingSum = filteredItems.reduce(
      (sum, item) => sum + (Number(item.shippingAmount) || 0),
      0
    )
    const earningForThisDelivery = itemsShippingSum > 0 ? itemsShippingSum : Number(assignment.order?.shipping || 0)

    const responseData = {
      ...assignment,
      earningForThisDelivery,
      order: {
        ...assignment.order,
        seller: assignment.seller || assignment.order.seller,
        items: filteredItems,
      },
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    })
  } catch (error: any) {
    console.error("[Mobile API] Rider order detail error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch order details" },
      { status: 500 }
    )
  }
}
