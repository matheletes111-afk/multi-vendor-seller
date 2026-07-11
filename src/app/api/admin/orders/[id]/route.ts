import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/rbac"
import { sendOrderItemStatusUpdateEmail } from "@/lib/email"

import type {
  AdminOrderDetailApi,
  AdminOrderDetailItemApi,
  AdminOrderItemStatusHistoryApi,
  PatchOrderStatusPayload,
} from "../types"
import { ADMIN_ORDER_STATUSES } from "../types"
import { deriveOrderStatus, summarizeSellerItemStatuses } from "@/lib/order-status"
import { parseReturnImagesJson } from "@/lib/return-request-validation"
import { completeExchangeOnReplacementDelivered } from "@/lib/exchange-completion"
import { applySellerCreditForOrderLineDelivered } from "@/lib/seller-order-line-settlement"
import {
  getOrderHasDeliveredLine,
  ORDER_CANCEL_BLOCKED_DELIVERED,
  ORDER_ITEM_LOCKED_AFTER_DELIVERED,
} from "@/lib/order-cancel-guard"
import { sendDeliveryOtp } from "@/lib/delivery-otp"

function isValidAdminStatus(s: string): s is PatchOrderStatusPayload["status"] {
  return ADMIN_ORDER_STATUSES.includes(s as PatchOrderStatusPayload["status"])
}

/** GET /api/admin/orders/[id] — get one order. ADMIN only. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id: orderId } = await params

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { name: true, email: true, phone: true, phoneCountryCode: true } },
      seller: { include: { store: { select: { name: true } } } },
      items: {
        include: {
          seller: { include: { store: { select: { name: true } }, user: { select: { name: true, email: true, phone: true, phoneCountryCode: true } } } },
          product: { select: { images: true } },
          productVariant: { select: { images: true, returnType: true, replacementAllowed: true } },
          service: { select: { images: true } },
          serviceSlot: { select: { startTime: true, endTime: true } },
          returnRequest: {
            select: {
              status: true,
              reason: true,
              returnImages: true,
              resolutionType: true,
              replacementOrderItemId: true,
              pickupStatus: true,
              refundStatus: true,
              exchangeTopUpAmount: true,
              exchangeTopUpStatus: true,
              exchangeRefundDifferenceAmount: true,
              exchangeRefundDifferenceStatus: true,
            },
          },
          statusHistory: {
            select: { status: true, location: true, note: true, createdAt: true },
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

  const items: AdminOrderDetailItemApi[] = order.items.map((row) => {
    const productImages = (row.product as { images?: unknown } | null)?.images
    const variantImages = (row.productVariant as { images?: unknown } | null)?.images
    const serviceImages = (row.service as { images?: unknown } | null)?.images
    const imageUrl =
      firstImageUrl(variantImages) ?? firstImageUrl(productImages) ?? firstImageUrl(serviceImages) ?? null
    const slot = row.serviceSlot as { startTime?: Date; endTime?: Date } | null
    const returnAvailable = row.productVariant?.returnType === "RETURNABLE"
    const replacementAllowed =
      !!row.productId && row.productVariant?.replacementAllowed === true && returnAvailable
    const req = row.returnRequest
    return {
      id: row.id,
      sellerId: row.sellerId,
      sellerStoreName: row.seller?.store?.name ?? null,
      sellerName: row.seller?.user?.name ?? null,
      sellerEmail: row.seller?.user?.email ?? null,
      sellerPhone: row.seller?.user?.phone ? `${row.seller?.user?.phoneCountryCode ?? ""}${row.seller?.user?.phone}` : null,
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
      serviceSlotStartTime: slot?.startTime ? slot.startTime.toISOString() : null,
      serviceSlotEndTime: slot?.endTime ? slot.endTime.toISOString() : null,
      shippingAmount: row.shippingAmount,
      commissionAmount: row.commissionAmount,
      commissionRateSnapshot: row.commissionRateSnapshot,
      deliveryProofImage: row.deliveryProofImage ?? null,
      deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
      deliveryOtp: (row as any).deliveryOtp ?? null,
      deliveryOtpExpires: (row as any).deliveryOtpExpires ? (row as any).deliveryOtpExpires.toISOString() : null,
      statusHistory: row.statusHistory.map(
        (h): AdminOrderItemStatusHistoryApi => ({
          status: h.status,
          location: h.location ?? null,
          note: h.note ?? null,
          createdAt: h.createdAt.toISOString(),
        })
      ),
      returnAvailable,
      replacementAllowed,
      returnResolutionType: returnAvailable ? req?.resolutionType ?? null : null,
      returnReason: returnAvailable ? req?.reason ?? null : null,
      returnImages: returnAvailable ? parseReturnImagesJson(req?.returnImages) : [],
      replacementOrderItemId: returnAvailable ? req?.replacementOrderItemId ?? null : null,
      exchangeSourceOrderItemId: row.exchangeSourceOrderItemId ?? null,
      exchangeTopUpAmount: returnAvailable ? req?.exchangeTopUpAmount ?? 0 : 0,
      exchangeTopUpStatus: returnAvailable ? req?.exchangeTopUpStatus ?? null : null,
      exchangeRefundDifferenceAmount: returnAvailable ? req?.exchangeRefundDifferenceAmount ?? 0 : 0,
      exchangeRefundDifferenceStatus: returnAvailable ? req?.exchangeRefundDifferenceStatus ?? null : null,
      returnRequestStatus: returnAvailable ? req?.status ?? null : null,
      pickupStatus: returnAvailable ? req?.pickupStatus ?? "NOT_REQUESTED" : null,
      refundStatus: returnAvailable ? req?.refundStatus ?? "NOT_REQUESTED" : null,
    }
  })

  const sellerGroupMap = new Map<
    string,
    {
      sellerId: string | null
      sellerStoreName: string | null
      subtotal: number
      tax: number
      shipping: number
      commission: number
      total: number
      statuses: import("@prisma/client").OrderStatus[]
      itemCount: number
    }
  >()
  for (const item of order.items) {
    const key = item.sellerId ?? "unknown"
    const current = sellerGroupMap.get(key) ?? {
      sellerId: item.sellerId ?? null,
      sellerStoreName: item.seller?.store?.name ?? null,
      subtotal: 0,
      tax: 0,
      shipping: 0,
      commission: 0,
      total: 0,
      statuses: [],
      itemCount: 0,
    }
    current.subtotal += item.subtotal
    current.tax += item.gstAmount
    current.shipping += item.shippingAmount
    current.commission += item.commissionAmount
    current.total += (item.subtotalInclGst ?? item.subtotal + item.gstAmount) + item.shippingAmount
    current.statuses.push(item.itemStatus)
    current.itemCount += 1
    sellerGroupMap.set(key, current)
  }
  const sellerGroups = [...sellerGroupMap.values()].map((group) => {
    const statusSummary = summarizeSellerItemStatuses(group.statuses)
    return {
      sellerId: group.sellerId,
      sellerStoreName: group.sellerStoreName,
      summary: {
        subtotal: group.subtotal,
        tax: group.tax,
        shipping: group.shipping,
        commission: group.commission,
        total: group.total,
      },
      itemStatuses: statusSummary.counts,
      derivedStatus: statusSummary.derivedStatus,
      itemCount: group.itemCount,
    }
  })

  const orderHasDeliveredLine = order.items.some((i) => i.itemStatus === "DELIVERED")

  const body: AdminOrderDetailApi = {
    id: order.id,
    orderNumber: order.orderNumber,
    orderHasDeliveredLine,
    status: deriveOrderStatus(order.items.map((item) => item.itemStatus)),
    totalAmount: order.totalAmount,
    subtotal: order.subtotal,
    tax: order.tax,
    shipping: order.shipping,
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
    sellerStoreName: order.seller?.store?.name ?? null,
    sellerGroups,
    items,
    couponCode: order.couponCode,
    couponDiscount: order.couponDiscount,
  }
  return NextResponse.json(body)
}

/** PATCH /api/admin/orders/[id] — update order status. ADMIN only. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id: orderId } = await params
  const order = await prisma.order.findUnique({ where: { id: orderId } })
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
  const { status } = payload
  const deliveryProofImage = typeof payload.deliveryProofImage === "string" ? payload.deliveryProofImage.trim() : ""
  const location = typeof payload.location === "string" ? payload.location.trim() : ""
  const note = typeof payload.note === "string" ? payload.note.trim() : ""
  const itemId = typeof (body as { itemId?: string }).itemId === "string" ? (body as { itemId?: string }).itemId : null
  const itemIds = Array.isArray((body as { itemIds?: string[] }).itemIds)
    ? (body as { itemIds?: string[] }).itemIds!.filter((v): v is string => typeof v === "string")
    : []
  const otpInput = typeof payload.otp === "string" ? payload.otp.trim() : ""
  if (!status || !isValidAdminStatus(status)) {
    return NextResponse.json(
      { error: "Invalid status. Use one of: " + ADMIN_ORDER_STATUSES.join(", ") },
      { status: 400 }
    )
  }

  const targetItemIds = [...new Set([...(itemId ? [itemId] : []), ...itemIds])]
  if (targetItemIds.length === 0) {
    if (status === "DELIVERED") {
      return NextResponse.json(
        {
          error:
            "Cannot mark every line item delivered from the bulk control. Use per-item update and upload delivery proof.",
        },
        { status: 400 }
      )
    }
    if (status === "CANCELLED" && (await getOrderHasDeliveredLine(prisma, orderId))) {
      return NextResponse.json({ error: ORDER_CANCEL_BLOCKED_DELIVERED }, { status: 400 })
    }
    if (await getOrderHasDeliveredLine(prisma, orderId)) {
      return NextResponse.json({ error: ORDER_ITEM_LOCKED_AFTER_DELIVERED }, { status: 400 })
    }
    await prisma.orderItem.updateMany({
      where: { orderId },
      data: { itemStatus: status } as any,
    })
    return NextResponse.json({ success: true, status, updatedAllItems: true })
  }

  const targetItems = (await prisma.orderItem.findMany({
    where: { orderId, id: { in: targetItemIds } },
    select: { id: true, itemStatus: true, productId: true, deliveryOtp: true, deliveryOtpExpires: true } as any,
  })) as any[]
  if (targetItems.length !== targetItemIds.length) {
    return NextResponse.json({ error: "One or more items are not in this order" }, { status: 404 })
  }
  if (targetItems.some((row) => row.itemStatus === "CANCELLED" || row.itemStatus === "REFUNDED")) {
    return NextResponse.json({ error: "Cannot change cancelled or refunded item status" }, { status: 400 })
  }
  if (targetItems.some((row) => row.itemStatus === "DELIVERED")) {
    return NextResponse.json({ error: ORDER_ITEM_LOCKED_AFTER_DELIVERED }, { status: 400 })
  }
  if (status === "CANCELLED" && (await getOrderHasDeliveredLine(prisma, orderId))) {
    return NextResponse.json({ error: ORDER_CANCEL_BLOCKED_DELIVERED }, { status: 400 })
  }
  if (status === "CANCELLED" && targetItems.some((row) => row.itemStatus !== "PENDING")) {
    return NextResponse.json({ error: "Can only cancel items that are PENDING" }, { status: 400 })
  }
  if (status === "DELIVERED" && !deliveryProofImage) {
    return NextResponse.json({ error: "Delivery proof image is required when marking delivered" }, { status: 400 })
  }

  // Service status validation: only PENDING, CONFIRMED, DELIVERED, CANCELLED allowed for services.
  const SERVICE_STATUSES = ["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"]
  if (!SERVICE_STATUSES.includes(status)) {
    const hasService = targetItems.some(item => !item.productId)
    if (hasService) {
      return NextResponse.json(
        { error: `Status "${status}" is not applicable to service items. Use one of: ${SERVICE_STATUSES.join(", ")}` },
        { status: 400 }
      )
    }
  }

  // OTP Verification for moving from OUT_FOR_DELIVERY to DELIVERED (Products only)
  if (status === "DELIVERED") {
    for (const item of (targetItems as any[])) {
      if (item.productId && item.itemStatus === "OUT_FOR_DELIVERY") {
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

  // Handle OUT_FOR_DELIVERY: Generate and Send OTP (Products only)
  let otpData: { otp: string; expiry: Date } | null = null
  if (status === "OUT_FOR_DELIVERY" && targetItems.some(i => i.productId)) {
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
    await prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { orderId, id: { in: targetItemIds } },
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
    const message = e instanceof Error ? e.message : "Failed to update order item status"
    console.error("PATCH admin order item status:", e)
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
