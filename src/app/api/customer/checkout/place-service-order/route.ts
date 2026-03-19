import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createServiceSlotIfAllowed } from "@/lib/service-slots"
import { UserRole } from "@prisma/client"

const COMMISSION_RATE = 10
const GST_RATE = 0.15

/** POST /api/customer/checkout/place-service-order — direct service booking (no cart). CUSTOMER only. */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== UserRole.CUSTOMER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const payload = body as {
    serviceId?: string
    slotStartTime?: string
    slotEndTime?: string
    addressId?: string
  }
  const serviceId = typeof payload.serviceId === "string" ? payload.serviceId.trim() : null
  const addressId = typeof payload.addressId === "string" ? payload.addressId.trim() : null
  if (!serviceId) {
    return NextResponse.json({ error: "serviceId required" }, { status: 400 })
  }
  if (!addressId) {
    return NextResponse.json({ error: "addressId required" }, { status: 400 })
  }

  const address = await prisma.userAddress.findFirst({
    where: { id: addressId, userId: session.user.id },
  })
  if (!address) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 })
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId, isActive: true },
    select: { id: true, name: true, sellerId: true, basePrice: true, discount: true, hasGst: true },
  })
  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 })
  }

  let serviceSlotId: string | null = null
  const slotStartTime = payload.slotStartTime ? new Date(payload.slotStartTime) : null
  const slotEndTime = payload.slotEndTime ? new Date(payload.slotEndTime) : null
  if (slotStartTime && slotEndTime && !isNaN(slotStartTime.getTime()) && !isNaN(slotEndTime.getTime()) && slotStartTime < slotEndTime) {
    try {
      const { id } = await createServiceSlotIfAllowed(serviceId, slotStartTime, slotEndTime)
      serviceSlotId = id
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string }
      if (e?.code === "P2002") {
        return NextResponse.json({ error: "This slot was just booked by someone else" }, { status: 409 })
      }
      return NextResponse.json(
        { error: typeof e?.message === "string" ? e.message : "Slot not available" },
        { status: 400 }
      )
    }
  }

  const unitPrice = Math.max(0, (service.basePrice ?? 0) - (service.discount ?? 0))
  const hasGst = service.hasGst ?? true
  const quantity = 1
  const subtotal = unitPrice * quantity
  const totalGst = hasGst ? subtotal * GST_RATE : 0
  const totalAmount = subtotal + totalGst
  const commission = totalAmount * (COMMISSION_RATE / 100)

  const order = await prisma.order.create({
    data: {
      customerId: session.user.id,
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
    },
  })

  await prisma.orderItem.create({
    data: {
      orderId: order.id,
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

  return NextResponse.json({
    success: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
  })
}