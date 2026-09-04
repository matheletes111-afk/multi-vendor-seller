import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { getMobileSellerAuth } from "../../../../_helpers/seller-auth"
import { triggerOrderAutoDispatch } from "@/lib/delivery-dispatch"

/**
 * PATCH /mobileapi/product-seller/orders/[id]/self-delivery
 * Mobile API endpoint to toggle in-house self-delivery on/off for a seller's package in an order.
 *
 * Headers: Authorization: Bearer <sellerToken>
 * Body: { "isSelfDelivery": true | false }
 *
 * Behavior:
 * - When isSelfDelivery = true:
 *   - Updates OrderItem.isSelfDelivery = true for all items belonging to this seller in this order.
 *   - Revokes and cancels any pending OFFERED/ACCEPTED delivery rider assignments.
 *   - Prevents auto-dispatch from notifying external delivery riders.
 *   - Customer delivery charges are credited directly to the seller's account upon delivery.
 * - When isSelfDelivery = false:
 *   - Restores platform rider delivery mode.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authStatus = await getMobileSellerAuth(request, UserRole.SELLER_PRODUCT)
  if (!authStatus.ok) {
    if (authStatus.error === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: authStatus.userId },
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

  // Guard against changing terminal items
  const isTerminal = sellerItems.some(
    (i) => i.itemStatus === "DELIVERED" || i.itemStatus === "CANCELLED" || i.itemStatus === "REFUNDED"
  )
  if (isTerminal) {
    return NextResponse.json(
      { error: "Cannot change delivery mode for delivered, cancelled, or refunded items" },
      { status: 400 }
    )
  }

  // Guard if rider has already picked up package
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
        { error: "Cannot switch to self-delivery: A platform rider has already collected this package." },
        { status: 400 }
      )
    }
  }

  // Update in transaction
  await prisma.$transaction(async (tx) => {
    // 1. Update OrderItem.isSelfDelivery
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

    // 2. Revoke any pending rider offers
    if (isSelfDelivery) {
      await tx.riderDeliveryAssignment.updateMany({
        where: {
          orderId,
          sellerId: seller.id,
          status: { in: ["OFFERED", "ACCEPTED", "AT_PICKUP"] },
        },
        data: {
          status: "CANCELLED_BY_RIDER",
          cancellationReason: "Seller switched to in-house Self-Delivery via Mobile App",
          cancelledAt: new Date(),
          adminNotes: "Auto-revoked offer/assignment: Mobile Seller activated self-delivery",
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
        console.error("[AutoDispatch] Mobile self-delivery toggle trigger failed:", err?.message || err)
      )
    }
  }

  return NextResponse.json({
    success: true,
    isSelfDelivery,
    message: isSelfDelivery
      ? "In-house self-delivery activated. Platform riders will not be notified."
      : "Platform rider delivery mode active.",
  })
}
