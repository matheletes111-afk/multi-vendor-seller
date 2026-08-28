import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "RIDER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const rider = await prisma.rider.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!rider) {
      return NextResponse.json({ error: "Rider profile not found" }, { status: 404 })
    }

    // Find either by assignment id or by order id
    const assignment = await prisma.riderDeliveryAssignment.findFirst({
      where: {
        riderId: rider.id,
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
              },
            },
          },
        },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    // Filter items to only show the items for this rider's assigned seller package
    const assignedSeller = assignment.seller || assignment.order?.seller || null
    const assignedItems = (assignment.order?.items || []).filter(
      (item) => !assignment.sellerId || item.sellerId === assignment.sellerId
    )
    const earningForThisDelivery = assignedItems.reduce(
      (sum, item) => sum + (Number(item.shippingAmount) || 0),
      0
    ) || Number(assignment.order?.shipping || 0)

    const sanitizedAssignment = {
      ...assignment,
      earningForThisDelivery,
      order: assignment.order
        ? {
            ...assignment.order,
            seller: assignedSeller,
            items: assignedItems,
          }
        : null,
    }

    return NextResponse.json({
      success: true,
      assignment: sanitizedAssignment,
    })
  } catch (error: any) {
    console.error("[API] Rider order detail error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch order details" },
      { status: 500 }
    )
  }
}
