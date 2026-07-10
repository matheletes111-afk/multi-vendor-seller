import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { allocateNextOrderNumberTx } from "@/lib/order-number"
import { createServiceSlotIfAllowed } from "@/lib/service-slots"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { UserRole } from "@prisma/client"
import { sendOrderConfirmationEmail, sendSellerNewOrderEmail, sendAdminNewOrderEmail } from "@/lib/email"
import { validateCoupon } from "@/lib/coupons"

export const dynamic = "force-dynamic"

const COMMISSION_RATE = 10
const GST_RATE = 0.15

type SuccessResponse = {
  success: true
  message: string
  data: { orderId: string; orderNumber: string | null }
}
type ErrorResponse = { success: false; error: string }

function unauthorized() {
  return NextResponse.json<ErrorResponse>(
    { success: false, error: "Unauthorized. Valid customer token required." },
    { status: 401 }
  )
}

/** POST /mobileapi/customer/checkout/place-service-order — direct service booking (same as web). Auth: Bearer (customer). */
export async function POST(request: NextRequest) {
  const auth = await getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }
  const payload = body as {
    serviceId?: string
    slotStartTime?: string
    slotEndTime?: string
    addressId?: string
    serviceSlotId?: string
    couponCode?: string
  }
  const serviceId = typeof payload.serviceId === "string" ? payload.serviceId.trim() : null
  const addressId = typeof payload.addressId === "string" ? payload.addressId.trim() : null
  if (!serviceId) {
    return NextResponse.json({ success: false, error: "serviceId required" }, { status: 400 })
  }
  if (!addressId) {
    return NextResponse.json({ success: false, error: "addressId required" }, { status: 400 })
  }

  const address = await prisma.userAddress.findFirst({
    where: { id: addressId, userId: auth.userId },
  })
  if (!address) {
    return NextResponse.json({ success: false, error: "Address not found" }, { status: 404 })
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, isActive: true, isDeleted: false },
    select: { id: true, name: true, sellerId: true, basePrice: true, discount: true, hasGst: true, isDeleted: true },
  })
  if (!service) {
    return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 })
  }

  let serviceSlotId: string | null = null
  const requestedSlotId =
    typeof payload.serviceSlotId === "string" && payload.serviceSlotId.trim() ? payload.serviceSlotId.trim() : null

  if (requestedSlotId) {
    const existing = await prisma.serviceSlot.findFirst({
      where: { id: requestedSlotId, serviceId: service.id },
      include: { orderItems: { select: { id: true } } },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: "Invalid service slot" }, { status: 400 })
    }
    if (existing.orderItems.length > 0) {
      return NextResponse.json({ success: false, error: "This slot is already used" }, { status: 400 })
    }
    serviceSlotId = existing.id
  } else {
    const slotStartTime = payload.slotStartTime ? new Date(payload.slotStartTime) : null
    const slotEndTime = payload.slotEndTime ? new Date(payload.slotEndTime) : null
    if (
      slotStartTime &&
      slotEndTime &&
      !isNaN(slotStartTime.getTime()) &&
      !isNaN(slotEndTime.getTime()) &&
      slotStartTime < slotEndTime
    ) {
      try {
        const { id } = await createServiceSlotIfAllowed(serviceId, slotStartTime, slotEndTime)
        serviceSlotId = id
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string }
        if (e?.code === "P2002") {
          return NextResponse.json(
            { success: false, error: "This slot was just booked by someone else" },
            { status: 409 }
          )
        }
        return NextResponse.json(
          { success: false, error: typeof e?.message === "string" ? e.message : "Slot not available" },
          { status: 400 }
        )
      }
    }
  }

  const unitPrice = Math.max(0, (service.basePrice ?? 0) - (service.discount ?? 0))
  const hasGst = service.hasGst ?? true
  const quantity = 1
  const subtotal = unitPrice * quantity
  const totalGst = hasGst ? subtotal * GST_RATE : 0

  // Coupon validation
  const rawCouponCode = typeof payload.couponCode === "string" ? payload.couponCode.trim().toUpperCase() : null
  let coupon = null
  let couponDiscount = 0
  if (rawCouponCode) {
    const validationResult = await validateCoupon({
      code: rawCouponCode,
      type: "SERVICE",
      subtotal,
      items: [{ serviceId: service.id, price: unitPrice, quantity: 1 }],
      userId: auth.userId,
    })
    if (!validationResult.valid) {
      return NextResponse.json({ success: false, error: validationResult.error }, { status: 400 })
    }
    coupon = validationResult.coupon
    couponDiscount = validationResult.discountAmount || 0
  }

  const totalAmount = Math.max(0, subtotal + totalGst - couponDiscount)
  const commission = totalAmount * (COMMISSION_RATE / 100)

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await allocateNextOrderNumberTx(tx)
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        customerId: auth.userId,
        sellerId: service.sellerId,
        status: "PENDING",
        totalAmount,
        subtotal,
        tax: totalGst,
        shipping: 0,
        commission,
        commissionRate: COMMISSION_RATE,
        paymentStatus: "PENDING",
        paymentMethod: "COD",
        shippingFullName: address.fullName,
        shippingPhone: address.phone,
        shippingAddressLine1: address.addressLine1,
        shippingAddressLine2: address.addressLine2,
        shippingCity: address.city,
        shippingState: address.state,
        shippingPostalCode: address.postalCode,
        shippingCountry: address.country,
        couponId: coupon ? (coupon as any).id : null,
        couponCode: coupon ? (coupon as any).code : null,
        couponDiscount,
      },
    })
    if (coupon) {
      await tx.couponUsage.create({
        data: {
          couponId: (coupon as any).id,
          userId: auth.userId,
          orderId: newOrder.id,
        },
      })
    }
    return newOrder
  })

  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      sellerId: service.sellerId,
      productId: null,
      productVariantId: null,
      serviceId: service.id,
      servicePackageId: null,
      serviceSlotId,
      productNameSnapshot: null,
      serviceNameSnapshot: service.name,
      quantity: 1,
      price: unitPrice,
      subtotal,
      hasGst: hasGst,
      gstAmount: totalGst,
      subtotalInclGst: subtotal + totalGst,
      itemStatus: "PENDING",
      shippingAmount: 0,
      commissionAmount: commission,
      commissionRateSnapshot: COMMISSION_RATE,
    },
  })

  await prisma.payment.create({
    data: {
      orderId: order.id,
      amount: totalAmount,
      status: "PENDING",
      method: "COD",
    },
  })

  // ── Send Email Notifications ───────────────────────────────────────────────
  try {
    const customerUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true, name: true },
    })

    if (customerUser) {
      const emailItems = [{
        name: service.name,
        quantity: 1,
        price: unitPrice,
        subtotal,
      }]

      const fullAddressString = [
        address.fullName,
        address.phone,
        address.addressLine1,
        address.addressLine2,
        `${address.city}, ${address.state} ${address.postalCode}`,
        address.country,
      ].filter(Boolean).join(", ")

      // Send Customer Email
      await sendOrderConfirmationEmail({
        to: customerUser.email,
        name: customerUser.name ?? "Customer",
        orderNumber: order.orderNumber,
        items: emailItems,
        subtotal,
        tax: totalGst,
        shipping: 0,
        totalAmount,
        shippingAddress: fullAddressString,
        paymentMethod: order.paymentMethod ?? "COD",
      })

      // Send Seller Email
      const seller = await prisma.seller.findUnique({
        where: { id: service.sellerId },
        include: {
          user: { select: { email: true, name: true } },
          store: { select: { name: true } },
        },
      })

      if (seller?.user?.email) {
        await sendSellerNewOrderEmail({
          to: seller.user.email,
          sellerName: seller.store?.name ?? seller.user.name ?? "Seller",
          orderNumber: order.orderNumber,
          items: [{ name: service.name, quantity: 1, subtotal }],
          customerName: customerUser.name ?? "Customer",
          shippingAddress: fullAddressString,
          shippingPhone: address.phone,
        })
      }

      // Send Admin Emails
      const admins = await prisma.user.findMany({
        where: { role: UserRole.ADMIN },
        select: { email: true },
      })

      const adminItems = [{
        name: service.name,
        quantity: 1,
        sellerStoreName: seller?.store?.name ?? seller?.user?.name ?? "Unknown Seller",
        subtotal,
      }]

      for (const admin of admins) {
        await sendAdminNewOrderEmail({
          to: admin.email,
          orderNumber: order.orderNumber,
          customerName: customerUser.name ?? "Customer",
          items: adminItems,
          totalAmount,
          commissionAmount: commission,
        })
      }
    }
  } catch (emailErr) {
    console.error("Failed to send order placement emails:", emailErr)
  }

  return NextResponse.json<SuccessResponse>({
    success: true,
    message: "Order placed",
    data: { orderId: order.id, orderNumber: order.orderNumber },
  })
}
