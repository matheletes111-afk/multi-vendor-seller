import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { triggerOrderAutoDispatch } from "@/lib/delivery-dispatch"

/**
 * PATCH /api/product-seller/orders/[id]/self-delivery
 * Toggles self-delivery mode (ON / OFF) for the seller's package in an order.
 * Default is OFF (platform riders).
 * If ON: cancels pending rider offers, prevents rider waterfall notifications,
 * and retains the delivery fee for the seller upon completion.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 })
  }

  const { id: orderId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const isSelfDelivery = Boolean((body as { isSelfDelivery?: boolean })?.isSelfDelivery)

  // Verify seller items in the order
  const sellerItems = await prisma.orderItem.findMany({
    where: {
      orderId,
      sellerId: seller.id,
      productId: { not: null },
    },
    select: { id: true, itemStatus: true, isSelfDelivery: true },
  })

  if (sellerItems.length === 0) {
    return NextResponse.json(
      { error: "No product order items found for this seller in the given order" },
      { status: 404 }
    )
  }

  // Check if items are already completed or terminal
  const isTerminal = sellerItems.some(
    (i) => i.itemStatus === "DELIVERED" || i.itemStatus === "CANCELLED" || i.itemStatus === "REFUNDED"
  )
  if (isTerminal) {
    return NextResponse.json(
      { error: "Cannot change delivery mode for delivered, cancelled, or refunded items" },
      { status: 400 }
    )
  }

  // Check if a rider has already picked up or is out for delivery with the package
  if (isSelfDelivery) {
    const activeInFlightRider = await prisma.riderDeliveryAssignment.findFirst({
      where: {
        orderId,
        sellerId: seller.id,
        status: { in: ["PICKED_UP", "OUT_FOR_DELIVERY"] },
      },
    })
    if (activeInFlightRider) {
      return NextResponse.json(
        { error: "Cannot switch to self-delivery: A platform rider has already picked up this package." },
        { status: 400 }
      )
    }
  }

  // Execute update in transaction
  await prisma.$transaction(async (tx) => {
    // 1. Update all order items for this seller in this order
    await tx.orderItem.updateMany({
      where: {
        orderId,
        sellerId: seller.id,
        productId: { not: null },
      },
      data: {
        isSelfDelivery,
      },
    })

    // 2. If turning ON self-delivery, cancel any active OFFERED or ACCEPTED rider assignments
    if (isSelfDelivery) {
      await tx.riderDeliveryAssignment.updateMany({
        where: {
          orderId,
          sellerId: seller.id,
          status: { in: ["OFFERED", "ACCEPTED", "AT_PICKUP"] },
        },
        data: {
          status: "CANCELLED_BY_RIDER",
          cancellationReason: "Seller opted for in-house Self-Delivery",
          cancelledAt: new Date(),
          adminNotes: "Auto-revoked offer/assignment: Seller activated self-delivery",
        },
      })
    }
  })

  // If turning OFF self-delivery (restoring platform riders) and order is ready/in-progress, trigger auto-dispatch
  if (!isSelfDelivery) {
    const isReadyForDispatch = sellerItems.some((i) =>
      ["CONFIRMED", "PROCESSING", "READY_FOR_PICKUP", "SHIPPED"].includes(i.itemStatus)
    )
    if (isReadyForDispatch) {
      triggerOrderAutoDispatch(orderId, seller.id).catch((err) =>
        console.error("[AutoDispatch] Self-delivery toggle trigger failed:", err?.message || err)
      )
    }
  }

  return NextResponse.json({
    success: true,
    isSelfDelivery,
    message: isSelfDelivery
      ? "In-house self-delivery activated. Platform riders will not be dispatched."
      : "Platform rider delivery mode restored.",
  })
}
