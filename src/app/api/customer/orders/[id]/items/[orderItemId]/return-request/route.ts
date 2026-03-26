import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import {
  validateReturnImageUrls,
  validateReturnReason,
} from "@/lib/return-request-validation"

/** POST /api/customer/orders/[id]/items/[orderItemId]/return-request */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderItemId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.CUSTOMER) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: orderId, orderItemId } = await params
  const body = (await request.json().catch(() => ({}))) as {
    reason?: string
    returnImages?: unknown
    resolutionType?: string
    replacementVariantId?: string
  }
  const reasonRaw = typeof body.reason === "string" ? body.reason : ""
  const reasonCheck = validateReturnReason(reasonRaw)
  if (!reasonCheck.ok) {
    return NextResponse.json({ error: reasonCheck.error }, { status: 400 })
  }
  const imgCheck = validateReturnImageUrls(body.returnImages)
  if (!imgCheck.ok) {
    return NextResponse.json({ error: imgCheck.error }, { status: 400 })
  }
  const reason = reasonCheck.value
  const returnImages = imgCheck.value
  const resolutionType = body.resolutionType === "EXCHANGE" ? "EXCHANGE" : "REFUND"
  const replacementVariantId =
    typeof body.replacementVariantId === "string" ? body.replacementVariantId.trim() : null

  const item = await prisma.orderItem.findFirst({
    where: {
      id: orderItemId,
      orderId,
      order: { customerId: session.user.id },
      productId: { not: null },
    },
    select: {
      id: true,
      orderId: true,
      sellerId: true,
      productId: true,
      productVariantId: true,
      itemStatus: true,
      deliveredAt: true,
      quantity: true,
      returnRequest: { select: { id: true } },
      productVariant: { select: { returnType: true, returnDays: true, replacementAllowed: true } },
    },
  })

  if (!item) return NextResponse.json({ error: "Order item not found" }, { status: 404 })
  if (!item.sellerId || !item.productId) return NextResponse.json({ error: "Seller not found for this item" }, { status: 400 })
  if (item.itemStatus !== "DELIVERED") {
    return NextResponse.json({ error: "Return is allowed only for delivered items" }, { status: 400 })
  }
  if (item.productVariant?.returnType !== "RETURNABLE") {
    return NextResponse.json({ error: "This item is not returnable" }, { status: 400 })
  }
  const returnDays = item.productVariant.returnDays ?? 0
  if (returnDays <= 0) {
    return NextResponse.json({ error: "Return period is not configured for this item" }, { status: 400 })
  }
  const deliveredAt = item.deliveredAt ?? null
  if (!deliveredAt) {
    return NextResponse.json({ error: "Return is allowed only after delivered confirmation" }, { status: 400 })
  }
  const now = Date.now()
  const deadline = deliveredAt.getTime() + returnDays * 24 * 60 * 60 * 1000
  if (now > deadline) {
    return NextResponse.json({ error: "Return period has expired for this item" }, { status: 400 })
  }
  if (item.returnRequest?.id) {
    return NextResponse.json({ error: "Return already requested for this item" }, { status: 409 })
  }

  let replacementVariantIdFinal: string | null = null
  if (resolutionType === "EXCHANGE") {
    if (item.productVariant?.replacementAllowed !== true) {
      return NextResponse.json({ error: "Exchange is not enabled for this variant" }, { status: 400 })
    }
    if (!replacementVariantId) {
      return NextResponse.json({ error: "Choose a replacement variant for exchange" }, { status: 400 })
    }
    const target = await prisma.productVariant.findFirst({
      where: { id: replacementVariantId, productId: item.productId },
    })
    if (!target || target.id === item.productVariantId) {
      return NextResponse.json({ error: "Invalid replacement variant" }, { status: 400 })
    }
    if (target.stock < item.quantity) {
      return NextResponse.json({ error: "Selected variant does not have enough stock" }, { status: 400 })
    }
    replacementVariantIdFinal = target.id
  }

  const created = await prisma.returnRequest.create({
    data: {
      orderItemId: item.id,
      orderId: item.orderId,
      customerId: session.user.id,
      sellerId: item.sellerId,
      reason,
      returnImages,
      status: "REQUESTED",
      pickupStatus: "NOT_REQUESTED",
      refundStatus: "NOT_REQUESTED",
      resolutionType,
      replacementVariantId: replacementVariantIdFinal,
    },
    select: {
      id: true,
      status: true,
      pickupStatus: true,
      refundStatus: true,
      resolutionType: true,
    },
  })

  return NextResponse.json({ success: true, returnRequest: created })
}

