import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isProductSeller } from "@/lib/rbac"
import { sendOrderItemStatusUpdateEmail } from "@/lib/email"

import type {
  PatchOrderStatusPayload,
  SellerOrderDetailApi,
  SellerOrderDetailItemApi,
} from "../types"
import { SELLER_ORDER_STATUSES } from "../types"
import { deriveOrderStatus } from "@/lib/order-status"
import { completeExchangeOnReplacementDelivered } from "@/lib/exchange-completion"
import {
  assertExchangeReplacementCanAdvance,
  ExchangeTopUpRequiredError,
} from "@/lib/exchange-guards"
import { parseReturnImagesJson } from "@/lib/return-request-validation"
import {
  getOrderHasDeliveredLine,
  ORDER_CANCEL_BLOCKED_DELIVERED,
  ORDER_ITEM_LOCKED_AFTER_DELIVERED,
} from "@/lib/order-cancel-guard"
import { applySellerCreditForOrderLineDelivered } from "@/lib/seller-order-line-settlement"
import { sendDeliveryOtp } from "@/lib/delivery-otp"

function isValidSellerStatus(s: string): s is PatchOrderStatusPayload["status"] {
  return SELLER_ORDER_STATUSES.includes(s as PatchOrderStatusPayload["status"])
}

/** GET /api/product-seller/orders/[id] — get one order for current product seller. */
export async function GET(
  _request: NextRequest,
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
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

  const { id: orderId } = await params
  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { sellerId: seller.id, productId: { not: null } } } },
    include: {
      customer: true,
      items: {
        where: { sellerId: seller.id, productId: { not: null } },
        include: {
          product: { select: { images: true } },
          productVariant: { select: { images: true, returnType: true, replacementAllowed: true } },
          service: { select: { images: true } },
          returnRequest: {
            select: {
              status: true,
              reason: true,
              returnImages: true,
              pickupStatus: true,
              refundStatus: true,
              resolutionType: true,
              replacementVariantId: true,
              replacementOrderItemId: true,
              exchangeTopUpAmount: true,
              exchangeTopUpStatus: true,
              exchangeRefundDifferenceAmount: true,
              exchangeRefundDifferenceStatus: true,
            },
          },
          statusHistory: {
            select: {
              status: true,
              location: true,
              note: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  function firstImageUrl(images: unknown): string | null {
    if (Array.isArray(images) && images.length > 0 && typeof images[0] === "string") return images[0]
    if (typeof images === "string") return images
    try {
      const parsed = typeof images === "string" ? JSON.parse(images) : images
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") return parsed[0]
    } catch {
      /* ignore */
    }
    return null
  }

  const items: SellerOrderDetailItemApi[] = order.items.map((row) => {
    const productImages = (row.product as { images?: unknown } | null)?.images
    const variantImages = (row.productVariant as { images?: unknown } | null)?.images
    const serviceImages = (row.service as { images?: unknown } | null)?.images
    const imageUrl =
      firstImageUrl(variantImages) ?? firstImageUrl(productImages) ?? firstImageUrl(serviceImages) ?? null
    const returnAvailable = row.productVariant?.returnType === "RETURNABLE"
    const replacementAllowed = row.productVariant?.replacementAllowed === true
    return {
      id: row.id,
      itemStatus: row.itemStatus,
      productNameSnapshot: row.productNameSnapshot,
      serviceNameSnapshot: row.serviceNameSnapshot,
      quantity: row.quantity,
      price: row.price,
      subtotal: row.subtotal,
      hasGst: row.hasGst,
      gstAmount: row.gstAmount,
      subtotalInclGst: row.subtotalInclGst,
      imageUrl,
      shippingAmount: row.shippingAmount,
      returnAvailable,
      replacementAllowed,
      returnResolutionType: row.returnRequest?.resolutionType ?? null,
      replacementOrderItemId: row.returnRequest?.replacementOrderItemId ?? null,
      returnReason: row.returnRequest?.reason ?? null,
      returnImages: parseReturnImagesJson(row.returnRequest?.returnImages),
      exchangeSourceOrderItemId: row.exchangeSourceOrderItemId ?? null,
      exchangeTopUpAmount: row.returnRequest?.exchangeTopUpAmount ?? 0,
      exchangeTopUpStatus: row.returnRequest?.exchangeTopUpStatus ?? null,
      exchangeRefundDifferenceAmount: row.returnRequest?.exchangeRefundDifferenceAmount ?? 0,
      exchangeRefundDifferenceStatus: row.returnRequest?.exchangeRefundDifferenceStatus ?? null,
      returnRequestStatus: row.returnRequest?.status ?? null,
      pickupStatus: row.returnRequest?.pickupStatus ?? (returnAvailable ? "NOT_REQUESTED" : null),
      refundStatus: row.returnRequest?.refundStatus ?? (returnAvailable ? "NOT_REQUESTED" : null),
      deliveryProofImage: row.deliveryProofImage ?? null,
      deliveredAt: (row as any).deliveredAt ? (row as any).deliveredAt.toISOString() : null,
      deliveryOtp: (row as any).deliveryOtp ?? null,
      deliveryOtpExpires: (row as any).deliveryOtpExpires ? (row as any).deliveryOtpExpires.toISOString() : null,
      statusHistory: row.statusHistory.map((h) => ({
        status: h.status,
        location: h.location ?? null,
        note: h.note ?? null,
        createdAt: h.createdAt.toISOString(),
      })),
    }
  })

  const orderHasDeliveredLine = await getOrderHasDeliveredLine(prisma, order.id)

  const sellerSubtotal = order.items.reduce((sum, item) => sum + item.subtotal, 0)
  let sellerCouponDiscount = 0
  if (order.couponDiscount && order.subtotal > 0) {
    sellerCouponDiscount = Number(((order.couponDiscount * sellerSubtotal) / order.subtotal).toFixed(2))
  }

  const body: SellerOrderDetailApi = {
    id: order.id,
    orderNumber: order.orderNumber,
    orderHasDeliveredLine,
    status: deriveOrderStatus(order.items.map((item) => item.itemStatus)),
    totalAmount: Math.max(0, order.items.reduce((sum, item) => sum + (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount, 0) - sellerCouponDiscount),
    subtotal: sellerSubtotal,
    tax: order.items.reduce((sum, item) => sum + item.gstAmount, 0),
    shipping: order.items.reduce((sum, item) => sum + item.shippingAmount, 0),
    commission: order.items.reduce((sum, item) => sum + item.commissionAmount, 0),
    commissionRate: order.commissionRate,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    shippingFullName: order.shippingFullName,
    shippingPhone: order.shippingPhone,
    shippingAddressLine1: order.shippingAddressLine1,
    shippingAddressLine2: order.shippingAddressLine2,
    shippingCity: order.shippingCity,
    shippingState: order.shippingState,
    shippingPostalCode: order.shippingPostalCode,
    shippingCountry: order.shippingCountry,
    createdAt: order.createdAt.toISOString(),
    customerName: order.customer?.name ?? null,
    customerEmail: order.customer?.email ?? null,
    customerPhone: order.customer?.phone ?? null,
    customerPhoneCountryCode: order.customer?.phoneCountryCode ?? null,
    items,
    couponCode: order.couponCode,
    couponDiscount: sellerCouponDiscount,
  }
  return NextResponse.json(body)
}

/** PATCH /api/product-seller/orders/[id] — update order status. */
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
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 })

  const { id: orderId } = await params
  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { sellerId: seller.id, productId: { not: null } } } },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const payload = body as PatchOrderStatusPayload & {
    deliveryProofImage?: string
    location?: string
    note?: string
  }
  const status = typeof payload.status === "string" ? payload.status.trim().toUpperCase() : null
  const deliveryProofImage =
    typeof payload.deliveryProofImage === "string" ? payload.deliveryProofImage.trim() : ""
  const location = typeof payload.location === "string" ? payload.location.trim() : ""
  const note = typeof payload.note === "string" ? payload.note.trim() : ""
  const itemId = typeof (body as { itemId?: string }).itemId === "string" ? (body as { itemId?: string }).itemId : null
  const itemIds = Array.isArray((body as { itemIds?: string[] }).itemIds)
    ? (body as { itemIds?: string[] }).itemIds!.filter((v): v is string => typeof v === "string")
    : []
  const otpInput = typeof payload.otp === "string" ? payload.otp.trim() : ""
  if (!status || !isValidSellerStatus(status)) {
    return NextResponse.json(
      { error: "Invalid status. Use one of: " + SELLER_ORDER_STATUSES.join(", ") },
      { status: 400 }
    )
  }
  const targetItemIds = [...new Set([...(itemId ? [itemId] : []), ...itemIds])]
  if (targetItemIds.length === 0) {
    return NextResponse.json({ error: "itemId or itemIds is required for item-level status update" }, { status: 400 })
  }

  const ownItems = (await prisma.orderItem.findMany({
    where: { orderId, id: { in: targetItemIds }, sellerId: seller.id, productId: { not: null } },
    select: { id: true, itemStatus: true, deliveryOtp: true, deliveryOtpExpires: true } as any,
  })) as any[]
  if (ownItems.length !== targetItemIds.length) {
    return NextResponse.json({ error: "One or more items are not found for this seller" }, { status: 404 })
  }
  if (ownItems.some((row) => row.itemStatus === "CANCELLED" || row.itemStatus === "REFUNDED" || row.itemStatus === "EXCHANGED")) {
    return NextResponse.json({ error: "Cannot change cancelled, refunded, or exchanged item status" }, { status: 400 })
  }
  if (ownItems.some((row) => row.itemStatus === "DELIVERED")) {
    return NextResponse.json({ error: ORDER_ITEM_LOCKED_AFTER_DELIVERED }, { status: 400 })
  }
  if (status === "CANCELLED" && (await getOrderHasDeliveredLine(prisma, orderId))) {
    return NextResponse.json({ error: ORDER_CANCEL_BLOCKED_DELIVERED }, { status: 400 })
  }
  if (status === "CANCELLED" && ownItems.some((row) => row.itemStatus !== "PENDING")) {
    return NextResponse.json({ error: "Can only cancel items that are PENDING" }, { status: 400 })
  }
  if (status === "DELIVERED" && !deliveryProofImage) {
    return NextResponse.json({ error: "Delivery proof image is required when marking delivered" }, { status: 400 })
  }

  // OTP Verification for moving from OUT_FOR_DELIVERY to DELIVERED
  if (status === "DELIVERED") {
    for (const item of (ownItems as any[])) {
      if (item.itemStatus === "OUT_FOR_DELIVERY") {
        if (!otpInput) {
          return NextResponse.json({ error: "OTP is required for delivery", itemId: item.id }, { status: 400 })
        }
        if (item.deliveryOtp !== otpInput) {
          return NextResponse.json({ error: "Invalid delivery OTP", itemId: item.id }, { status: 400 })
        }
        if (item.deliveryOtpExpires && new Date() > item.deliveryOtpExpires) {
          return NextResponse.json({ error: "Delivery OTP has expired", itemId: item.id }, { status: 400 })
        }
      }
    }
  }

  // Handle OUT_FOR_DELIVERY: Generate and Send OTP
  let otpData: { otp: string; expiry: Date } | null = null
  if (status === "OUT_FOR_DELIVERY") {
    const fullOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { select: { email: true, phone: true, phoneCountryCode: true, name: true } } }
    })
    if (!fullOrder || !fullOrder.customer) {
      return NextResponse.json({ error: "Customer details not found for OTP" }, { status: 404 })
    }
    
    const combinedPhone = 
      fullOrder.customer.phoneCountryCode && fullOrder.customer.phone
        ? `+${fullOrder.customer.phoneCountryCode.replace(/\D/g, "")}${fullOrder.customer.phone.replace(/\D/g, "")}`
        : fullOrder.customer.phone

    otpData = await sendDeliveryOtp({
      toEmail: fullOrder.customer.email,
      toPhone: combinedPhone,
      orderNumber: fullOrder.orderNumber,
      customerName: fullOrder.customer.name,
    })
  }

  try {
    // Commit shipment updates first; run exchange completion in a second transaction.
    // A single long interactive transaction can trigger P2028 ("Transaction not found") on some setups.
    await prisma.$transaction(async (tx) => {
      for (const id of targetItemIds) {
        await assertExchangeReplacementCanAdvance(tx, id, status as any)
      }
      await tx.orderItem.updateMany({
        where: { id: { in: targetItemIds }, orderId, sellerId: seller.id, productId: { not: null } },
        data:
          status === "DELIVERED"
            ? ({ itemStatus: status as any, deliveredAt: new Date(), deliveryProofImage } as any)
            : status === "OUT_FOR_DELIVERY" && otpData
            ? ({ itemStatus: status as any, deliveryOtp: otpData.otp, deliveryOtpExpires: otpData.expiry } as any)
            : ({ itemStatus: status as any } as any),
      })
      await tx.orderItemStatusHistory.createMany({
        data: targetItemIds.map((id) => ({
          orderItemId: id,
          status: status as any,
          location: location || null,
          note: note || null,
        })),
      })
      if (status === "DELIVERED") {
        for (const id of targetItemIds) {
          await applySellerCreditForOrderLineDelivered(tx, id)
        }
      }
    })

    if (status === "DELIVERED") {
      await prisma.$transaction(async (tx) => {
        for (const itemId of targetItemIds) {
          await completeExchangeOnReplacementDelivered(tx, itemId)
        }
      })
    }
  } catch (e) {
    if (e instanceof ExchangeTopUpRequiredError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const message = e instanceof Error ? e.message : "Failed to update order item status"
    console.error("PATCH product-seller order item status:", e)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // ── Send Email Notifications ───────────────────────────────────────────────
  try {
    const fullOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { email: true, name: true } },
        items: { where: { id: { in: targetItemIds } } },
      },
    })
    if (fullOrder && fullOrder.customer) {
      for (const item of fullOrder.items) {
        await sendOrderItemStatusUpdateEmail({
          to: fullOrder.customer.email,
          name: fullOrder.customer.name ?? "Customer",
          orderNumber: fullOrder.orderNumber,
          itemName: item.productNameSnapshot ?? item.serviceNameSnapshot ?? "Item",
          status,
        })
      }
    }
  } catch (emailErr) {
    console.error("Failed to send status update email:", emailErr)
  }

  return NextResponse.json({ success: true, status, updatedItemIds: targetItemIds })
}
