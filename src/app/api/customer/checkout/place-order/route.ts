import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { allocateNextOrderNumberTx } from "@/lib/order-number"
import { UserRole, PlanType } from "@prisma/client"
import { isSellerSubscriptionActive } from "@/lib/subscriptions"
import type { PlaceOrderResponse } from "../types"
import { sendOrderConfirmationEmail, sendSellerNewOrderEmail, sendAdminNewOrderEmail } from "@/lib/email"
import { validateCoupon } from "@/lib/coupons"
import { calculateShippingBreakup, getRegionDeliveryChargeDetails } from "@/lib/shipping-calculator"
import { initiateAfriMoneyPushUssd } from "@/lib/afrimoney"
import { createFlotPaymentLink } from "@/lib/flot"


const CHECKOUT_CART_INCLUDE = {
  product: { select: { sellerId: true, name: true, isActive: true, isDeleted: true } },
  productVariant: { select: { name: true, weight: true, height: true, width: true, depth: true } },
  service: { select: { sellerId: true, name: true, isActive: true, isDeleted: true } },
  servicePackage: { select: { name: true } },
} as const

type CartItemForCheckout = Awaited<
  ReturnType<
    typeof prisma.cartItem.findMany<{ include: typeof CHECKOUT_CART_INCLUDE }>
  >
>[number] & {
  unitPrice: number
  totalPrice: number
  hasGst: boolean
  totalGst: number
  totalPriceInclGst: number | null
}

function getSellerId(item: CartItemForCheckout): string | null {
  return item.product?.sellerId ?? item.service?.sellerId ?? null
}

function getItemName(item: CartItemForCheckout): { productName: string | null; serviceName: string | null } {
  if (item.product && item.productVariant) {
    return { productName: `${item.product.name} (${item.productVariant.name})`, serviceName: null }
  }
  if (item.product) {
    return { productName: item.product.name, serviceName: null }
  }
  if (item.service && item.servicePackage) {
    return { productName: null, serviceName: `${item.service.name} - ${item.servicePackage.name}` }
  }
  if (item.service) {
    return { productName: null, serviceName: item.service.name }
  }
  return { productName: null, serviceName: null }
}

/** Resolve the effective commission rate for a seller.
 *  Priority: seller-specific override > global base rate > hard-coded fallback (10%) */
async function resolveCommissionRates(
  sellerIds: string[]
): Promise<{ baseRate: number; sellerMap: Map<string, number> }> {
  const DEFAULT_RATE = 10

  // Use raw query to avoid TS complaining about newly-added fields that may not
  // yet be reflected in the generated Prisma client types.
  const [globalRows, sellerRows] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).globalSetting.findFirst() as Promise<{ baseCommission?: number; productBaseCommission?: number } | null>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).seller.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, commissionRate: true },
    }) as Promise<{ id: string; commissionRate: number | null }[]>,
  ])

  const baseRate: number = globalRows?.productBaseCommission ?? globalRows?.baseCommission ?? DEFAULT_RATE
  const sellerMap = new Map<string, number>()
  for (const s of sellerRows) {
    sellerMap.set(s.id, s.commissionRate ?? baseRate)
  }
  return { baseRate, sellerMap }
}

/** POST /api/customer/checkout/place-order — create one order with item-level seller ownership. CUSTOMER only. */
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
    addressId?: string
    couponCode?: string
    paymentMethod?: string
    payerMsisdn?: string
  }
  const addressId = typeof payload.addressId === "string" ? payload.addressId.trim() : null
  const couponCode = typeof payload.couponCode === "string" ? payload.couponCode.trim().toUpperCase() : null
  const requestedPaymentMethod =
    payload.paymentMethod === "AFRIMONEY"
      ? "AFRIMONEY"
      : payload.paymentMethod === "FLOAT"
      ? "FLOAT"
      : "COD"
  const payerMsisdn = typeof payload.payerMsisdn === "string" ? payload.payerMsisdn.trim() : ""

  if (requestedPaymentMethod === "AFRIMONEY" && !payerMsisdn) {
    return NextResponse.json({ error: "AfriMoney phone number (payerMsisdn) is required for AfriMoney payment" }, { status: 400 })
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

  // ── Cart ────────────────────────────────────────────────────────────────────
  const cartItems = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: CHECKOUT_CART_INCLUDE,
    orderBy: { createdAt: "asc" },
  })
  const items = (cartItems as CartItemForCheckout[]).filter(
    (i) => i.productId != null || i.serviceId != null
  )

  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 })
  }

  // Double check that no products/services in cart were recently deleted or made inactive
  for (const item of items) {
    if (item.productId && (!item.product || item.product.isDeleted || !item.product.isActive)) {
      return NextResponse.json(
        { error: `Product "${item.product?.name || "Unknown"}" is no longer available.` },
        { status: 400 }
      )
    }
    if (item.serviceId && (!item.service || item.service.isDeleted || !item.service.isActive)) {
      return NextResponse.json(
        { error: `Service "${item.service?.name || "Unknown"}" is no longer available.` },
        { status: 400 }
      )
    }
  }

  // ── Seller Subscription Validation ──────────────────────────────────────────
  const checkoutSellerIds = [...new Set(items.map((i) => getSellerId(i)).filter(Boolean) as string[])]
  for (const sId of checkoutSellerIds) {
    const isSubActive = await isSellerSubscriptionActive(PlanType.PRODUCT_SERVICE, sId)
    if (!isSubActive) {
      const badItem = items.find((i) => getSellerId(i) === sId)
      const name = badItem ? (badItem.product?.name || badItem.service?.name || "Item") : "An item"
      return NextResponse.json(
        { error: `The store selling "${name}" is currently unavailable or their subscription has expired. Please remove this item to proceed.` },
        { status: 400 }
      )
    }
  }

  // ── Stock Validation ────────────────────────────────────────────────────────
  const variantIds = [
    ...new Set(items.map((i) => i.productVariantId).filter(Boolean)),
  ] as string[]

  if (variantIds.length > 0) {
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, stock: true, name: true },
    })
    const variantById = new Map(variants.map((v) => [v.id, v]))
    for (const item of items) {
      if (item.productVariantId) {
        const v = variantById.get(item.productVariantId)
        if (!v) {
          return NextResponse.json(
            { error: "A product variant in your cart is no longer available." },
            { status: 400 }
          )
        }
        if (v.stock < item.quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for "${v.name}". Available: ${v.stock}, requested: ${item.quantity}.` },
            { status: 400 }
          )
        }
      }
    }
  }

  // ── Normalise items (attach sellerId) ───────────────────────────────────────
  const normalizedItems = items
    .map((item) => ({ item, sellerId: getSellerId(item) }))
    .filter((row): row is { item: CartItemForCheckout; sellerId: string } => !!row.sellerId)

  if (normalizedItems.length === 0) {
    return NextResponse.json({ error: "No seller-mapped items found in cart" }, { status: 400 })
  }

  // ── Totals ──────────────────────────────────────────────────────────────────
  const subtotal = normalizedItems.reduce((sum, row) => sum + row.item.totalPrice, 0)
  const tax = normalizedItems.reduce((sum, row) => sum + row.item.totalGst, 0)

  // Fetch delivery settings
  const globalSetting = await prisma.globalSetting.findFirst()
  const weightRanges = (globalSetting?.deliveryChargeRanges as any[]) || []
  const dimensionRanges = (globalSetting?.dimensionDeliveryChargeRanges as any[]) || []
  const regionCharges = (globalSetting?.regionDeliveryCharges as any[]) || []

  let shipping = 0
  let totalWeightFee = 0
  let totalDimFee = 0
  let totalRegionFee = 0
  const itemsBySeller = new Map<string, CartItemForCheckout[]>()
  for (const row of normalizedItems) {
    const list = itemsBySeller.get(row.sellerId) || []
    list.push(row.item)
    itemsBySeller.set(row.sellerId, list)
  }

  const sellerShippingMap = new Map<string, number>()
  for (const [sellerId, sellerItems] of itemsBySeller.entries()) {
    const shippingItems = sellerItems.map((item) => {
      const variant = (item as any).productVariant
      return {
        weight: variant?.weight ?? 0,
        height: variant?.height ?? 0,
        width: variant?.width ?? 0,
        depth: variant?.depth ?? 0,
        quantity: item.quantity,
        isPhysical: item.productId != null,
      }
    })

    const breakup = calculateShippingBreakup({
      items: shippingItems,
      destinationState: address.state,
      weightRanges,
      dimensionRanges,
      regionCharges,
    })

    totalWeightFee += breakup.weightShippingFee
    totalDimFee += breakup.dimensionShippingFee
    totalRegionFee += breakup.regionShippingFee

    const sellerShipping = breakup.totalShippingFee
    sellerShippingMap.set(sellerId, sellerShipping)
    shipping += sellerShipping
  }

  const regionBreakupDetails = getRegionDeliveryChargeDetails(address.state, regionCharges)
  const shippingBreakup = {
    weightShippingFee: totalWeightFee,
    dimensionShippingFee: totalDimFee,
    regionShippingFee: totalRegionFee,
    totalShippingFee: shipping,
    matchedRegionName: regionBreakupDetails.matchedRegionName,
    matchedZoneName: regionBreakupDetails.matchedZoneName,
  }

  const orderPhysicalItems = normalizedItems.filter((row) => row.item.productId != null)
  const orderPhysicalSubtotal = orderPhysicalItems.reduce((sum, row) => sum + row.item.totalPrice, 0)

  const lineShippingFees = normalizedItems.map((row) => {
    if (row.item.serviceId) return 0
    const sellerShipping = sellerShippingMap.get(row.sellerId) || 0
    const sellerItems = itemsBySeller.get(row.sellerId) || []
    const physicalItems = sellerItems.filter((i) => i.productId)
    if (physicalItems.length === 0) return 0
    const sellerSubtotal = physicalItems.reduce((s, i) => s + i.totalPrice, 0)
    const linePhysical = sellerSubtotal > 0
      ? (row.item.totalPrice / sellerSubtotal) * sellerShipping
      : sellerShipping / physicalItems.length
    return Math.round(linePhysical * 100) / 100
  })

  // Absorb rounding cents onto the last physical item so sum(lineShippingFees) === shipping
  const sumLineShipping = lineShippingFees.reduce((a, b) => a + b, 0)
  const remainder = Math.round((shipping - sumLineShipping) * 100) / 100
  if (remainder !== 0 && orderPhysicalItems.length > 0) {
    const lastPhysicalIdx = normalizedItems.findLastIndex((row) => row.item.productId != null)
    if (lastPhysicalIdx !== -1) {
      lineShippingFees[lastPhysicalIdx] = Math.round((lineShippingFees[lastPhysicalIdx] + remainder) * 100) / 100
    }
  }

  const hasService = normalizedItems.some(row => row.item.serviceId != null)
  const orderType = hasService ? "SERVICE" : "PRODUCT"

  let coupon = null
  let couponDiscount = 0
  if (couponCode) {
    const validationResult = await validateCoupon({
      code: couponCode,
      type: orderType,
      subtotal,
      items: normalizedItems.map(row => ({
        productId: row.item.productId ?? undefined,
        serviceId: row.item.serviceId ?? undefined,
        price: row.item.unitPrice,
        quantity: row.item.quantity
      })),
      userId: session.user.id
    })

    if (!validationResult.valid) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 })
    }
    coupon = validationResult.coupon
    couponDiscount = validationResult.discountAmount || 0
  }

  const totalAmount = Math.max(0, subtotal + tax + shipping - couponDiscount)

  // ── Commission Calculation (server-side only, hidden from customer) ──────────
  const uniqueSellerIds = [...new Set(normalizedItems.map((n) => n.sellerId))]
  const { baseRate, sellerMap } = await resolveCommissionRates(uniqueSellerIds)

  let totalOrderCommission = 0
  const itemCommissionData = normalizedItems.map((row, idx) => {
    const rate = sellerMap.get(row.sellerId) ?? baseRate
    const lineTotalInclGst =
      row.item.totalPriceInclGst ?? row.item.totalPrice + row.item.totalGst
    const itemShippingAmount = lineShippingFees[idx]
    const commAmt = lineTotalInclGst * (rate / 100)
    totalOrderCommission += commAmt
    return { rate, commAmt, lineTotalInclGst, itemShippingAmount }
  })

  // ── Create Order ────────────────────────────────────────────────────────────
  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await allocateNextOrderNumberTx(tx)
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        customerId: session.user.id,
        sellerId: null,
        status: "PENDING",
        totalAmount,
        subtotal,
        tax,
        shipping,
        weightShippingFee: shippingBreakup.weightShippingFee,
        dimensionShippingFee: shippingBreakup.dimensionShippingFee,
        regionShippingFee: shippingBreakup.regionShippingFee,
        commission: totalOrderCommission,
        commissionRate: baseRate,
        paymentStatus: "PENDING",
        paymentMethod: requestedPaymentMethod,
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
          userId: session.user.id,
          orderId: newOrder.id,
        },
      })
    }

    return newOrder
  })

  // ── Create Order Items ──────────────────────────────────────────────────────
  for (let idx = 0; idx < normalizedItems.length; idx++) {
    const row = normalizedItems[idx]
    const { productName, serviceName } = getItemName(row.item)
    const itemData = itemCommissionData[idx]

    const createdItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        sellerId: row.sellerId,
        productId: row.item.productId,
        productVariantId: row.item.productVariantId,
        serviceId: row.item.serviceId,
        servicePackageId: row.item.servicePackageId,
        serviceSlotId: row.item.serviceSlotId,
        productNameSnapshot: productName,
        serviceNameSnapshot: serviceName,
        quantity: row.item.quantity,
        price: row.item.unitPrice,
        subtotal: row.item.totalPrice,
        hasGst: row.item.hasGst,
        gstAmount: row.item.totalGst,
        subtotalInclGst: itemData.lineTotalInclGst,
        itemStatus: "PENDING",
        settlementStatus: (requestedPaymentMethod === "AFRIMONEY" || requestedPaymentMethod === "FLOAT") ? "ESCROW_HELD" : "PENDING",
        shippingAmount: itemData.itemShippingAmount,
        commissionAmount: itemData.commAmt,
        commissionRateSnapshot: itemData.rate,
      },
    })

    await prisma.orderItemStatusHistory.create({
      data: {
        orderItemId: createdItem.id,
        status: "PENDING",
        note: "Order placed",
      },
    })

    if (row.item.productVariantId) {
      await prisma.productVariant.update({
        where: { id: row.item.productVariantId },
        data: { stock: { decrement: row.item.quantity } },
      })
    }
  }

  let afriTxnId: string | undefined = undefined
  let ussdPromptSent = false
  let pushMessage = ""
  let flotPaymentLink: string | null = null
  let flotOrderId: string | null = null

  if (requestedPaymentMethod === "AFRIMONEY") {
    const externalRef = `ORD_${order.id}`
    try {
      const pushResult = await initiateAfriMoneyPushUssd({
        amount: totalAmount,
        payerMsisdn,
        externalReferenceId: externalRef,
        remarks: `Order ${order.orderNumber}`,
      })

      if (pushResult.success) {
        ussdPromptSent = true
        afriTxnId = pushResult.txnId
        pushMessage = pushResult.message || "USSD push prompt sent to your phone. Please enter your AfriMoney PIN."
        await prisma.order.update({
          where: { id: order.id },
          data: {
            afriFtxnId: externalRef,
            afriTxnId: pushResult.txnId || null,
            afriMsisdn: payerMsisdn,
          },
        })
      } else {
        // Immediate push failure - rollback order, variant stocks, service slots & coupon
        for (const row of normalizedItems) {
          if (row.item.productVariantId) {
            await prisma.productVariant.update({
              where: { id: row.item.productVariantId },
              data: { stock: { increment: row.item.quantity } },
            }).catch(() => null)
          }
          if (row.item.serviceSlotId) {
            await prisma.serviceSlot.update({
              where: { id: row.item.serviceSlotId },
              data: { isBooked: false },
            }).catch(() => null)
          }
        }
        await prisma.couponUsage.deleteMany({
          where: { orderId: order.id },
        }).catch(() => null)
        await prisma.order.delete({ where: { id: order.id } }).catch(() => null)
        return NextResponse.json(
          { error: pushResult.message || "Failed to initiate AfriMoney USSD payment. Please check your phone number and try again." },
          { status: 400 }
        )
      }
    } catch (pushErr: any) {
      for (const row of normalizedItems) {
        if (row.item.productVariantId) {
          await prisma.productVariant.update({
            where: { id: row.item.productVariantId },
            data: { stock: { increment: row.item.quantity } },
          }).catch(() => null)
        }
        if (row.item.serviceSlotId) {
          await prisma.serviceSlot.update({
            where: { id: row.item.serviceSlotId },
            data: { isBooked: false },
          }).catch(() => null)
        }
      }
      await prisma.couponUsage.deleteMany({
        where: { orderId: order.id },
      }).catch(() => null)
      await prisma.order.delete({ where: { id: order.id } }).catch(() => null)
      return NextResponse.json(
        { error: `AfriMoney connection error: ${pushErr?.message || "Payment service unavailable"}` },
        { status: 502 }
      )
    }
  } else if (requestedPaymentMethod === "FLOAT") {
    const externalRef = `ORD_${order.id}`
    try {
      const flotRes = await createFlotPaymentLink({
        orderId: externalRef,
        amount: totalAmount,
        currency: "SLE",
        type: "card",
      })

      flotPaymentLink = flotRes.link
      flotOrderId = externalRef

      await prisma.order.update({
        where: { id: order.id },
        data: {
          flotOrderId: externalRef,
          flotInternalOrderId: flotRes.id,
          flotPaymentLink: flotRes.link,
          paymentMethod: "FLOAT",
        },
      })
    } catch (flotErr: any) {
      for (const row of normalizedItems) {
        if (row.item.productVariantId) {
          await prisma.productVariant.update({
            where: { id: row.item.productVariantId },
            data: { stock: { increment: row.item.quantity } },
          }).catch(() => null)
        }
        if (row.item.serviceSlotId) {
          await prisma.serviceSlot.update({
            where: { id: row.item.serviceSlotId },
            data: { isBooked: false },
          }).catch(() => null)
        }
      }
      await prisma.couponUsage.deleteMany({
        where: { orderId: order.id },
      }).catch(() => null)
      await prisma.order.delete({ where: { id: order.id } }).catch(() => null)
      return NextResponse.json(
        { error: `Float payment initiation failed: ${flotErr?.message || "Payment service unavailable"}` },
        { status: 502 }
      )
    }
  }

  // ── Payment & Cleanup ───────────────────────────────────────────────────────
  await prisma.payment.create({
    data: {
      orderId: order.id,
      amount: totalAmount,
      status: "PENDING",
      method: requestedPaymentMethod,
      gatewayReferenceId: flotOrderId || afriTxnId || null,
    },
  })

  // For COD, order is immediately confirmed so we clear the cart items.
  // For AFRIMONEY and FLOAT, we keep cart items until payment verification succeeds
  // so that if the user cancels or payment fails, their cart is preserved.
  if (requestedPaymentMethod === "COD") {
    await prisma.cartItem.deleteMany({
      where: { userId: session.user.id },
    })
  }

  // ── Send Email Notifications (Only for COD here; for online prepaid (AfriMoney & Float), sent upon payment confirmation)
  if (requestedPaymentMethod === "COD") {
    try {
    const customerUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true, phone: true, phoneCountryCode: true },
    })

    if (customerUser) {
      const emailItems = normalizedItems.map((row) => {
        const { productName, serviceName } = getItemName(row.item)
        const name = productName ?? serviceName ?? "Item"
        return {
          name,
          quantity: row.item.quantity,
          price: row.item.unitPrice,
          subtotal: row.item.totalPrice,
          sellerId: row.sellerId,
        }
      })

      const fullAddressString = [
        address.fullName,
        address.phone,
        address.addressLine1,
        address.addressLine2,
        `${address.city}, ${address.state} ${address.postalCode}`,
        address.country,
      ].filter(Boolean).join(", ")

      // Send Customer Email / SMS fallback
      await sendOrderConfirmationEmail({
        to: customerUser.email,
        toPhone: customerUser.phone,
        phoneCountryCode: customerUser.phoneCountryCode,
        name: customerUser.name ?? "Customer",
        orderNumber: order.orderNumber,
        items: emailItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, subtotal: i.subtotal })),
        subtotal,
        tax,
        shipping,
        totalAmount,
        shippingAddress: fullAddressString,
        paymentMethod: order.paymentMethod ?? "COD",
      })

      // Send Seller Emails / SMS fallback
      const sellers = await prisma.seller.findMany({
        where: { id: { in: uniqueSellerIds } },
        include: {
          user: { select: { email: true, name: true, phone: true, phoneCountryCode: true } },
          store: { select: { name: true } },
        },
      })

      for (const seller of sellers) {
        if (seller.user?.email || seller.user?.phone) {
          const sellerItems = emailItems.filter((i) => i.sellerId === seller.id)
          await sendSellerNewOrderEmail({
            to: seller.user?.email,
            toPhone: seller.user?.phone,
            phoneCountryCode: seller.user?.phoneCountryCode,
            sellerName: seller.store?.name ?? seller.user?.name ?? "Seller",
            orderNumber: order.orderNumber,
            items: sellerItems.map(i => ({ name: i.name, quantity: i.quantity, subtotal: i.subtotal })),
            customerName: customerUser.name ?? "Customer",
            shippingAddress: fullAddressString,
            shippingPhone: address.phone,
          })
        }
      }

      // Send Admin Emails
      const admins = await prisma.user.findMany({
        where: { role: UserRole.ADMIN },
        select: { email: true, phone: true, phoneCountryCode: true },
      })

      const adminItems = emailItems.map((i) => {
        const seller = sellers.find((s) => s.id === i.sellerId)
        return {
          name: i.name,
          quantity: i.quantity,
          sellerStoreName: seller?.store?.name ?? seller?.user?.name ?? "Unknown Seller",
          subtotal: i.subtotal,
        }
      })

      for (const admin of admins) {
        await sendAdminNewOrderEmail({
          to: admin.email,
          toPhone: admin.phone,
          phoneCountryCode: admin.phoneCountryCode,
          orderNumber: order.orderNumber,
          customerName: customerUser.name ?? "Customer",
          items: adminItems,
          totalAmount,
          commissionAmount: totalOrderCommission,
        })
      }
    }
  } catch (emailErr) {
    console.error("Failed to send order placement emails:", emailErr)
  }
  }

  // ── Response (customer-facing — NO commission data exposed) ─────────────────
  const response: PlaceOrderResponse = {
    success: true,
    orderIds: [order.id],
    orders: [
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        sellerId: "MULTI",
        totalAmount,
        itemCount: normalizedItems.length,
        couponCode: order.couponCode ?? undefined,
        couponDiscount: order.couponDiscount,
      },
    ],
  }
  return NextResponse.json({
    ...response,
    paymentMethod: requestedPaymentMethod,
    ussdPromptSent,
    afriTxnId,
    flotPaymentLink,
    flotOrderId,
    message: pushMessage,
    shippingBreakup,
  })
}
