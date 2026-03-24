import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import type { PlaceOrderResponse } from "../types"

const CHECKOUT_CART_INCLUDE = {
  product: { select: { sellerId: true, name: true } },
  productVariant: { select: { name: true } },
  service: { select: { sellerId: true, name: true } },
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
  const sellerId = item.product?.sellerId ?? item.service?.sellerId ?? null
  return sellerId
}

function getItemName(item: CartItemForCheckout): { productName: string | null; serviceName: string | null } {
  if (item.product && item.productVariant) {
    return {
      productName: `${item.product.name} (${item.productVariant.name})`,
      serviceName: null,
    }
  }
  if (item.product) {
    return { productName: item.product.name, serviceName: null }
  }
  if (item.service && item.servicePackage) {
    return {
      productName: null,
      serviceName: `${item.service.name} - ${item.servicePackage.name}`,
    }
  }
  if (item.service) {
    return { productName: null, serviceName: item.service.name }
  }
  return { productName: null, serviceName: null }
}

const COMMISSION_RATE = 10

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
  const payload = body as { addressId?: string }
  const addressId = typeof payload.addressId === "string" ? payload.addressId.trim() : null
  if (!addressId) {
    return NextResponse.json({ error: "addressId required" }, { status: 400 })
  }

  const address = await prisma.userAddress.findFirst({
    where: { id: addressId, userId: session.user.id },
  })
  if (!address) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 })
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: CHECKOUT_CART_INCLUDE,
    orderBy: { createdAt: "asc" },
  })
  const items = (cartItems as CartItemForCheckout[]).filter((i) => i.productId != null || i.serviceId != null)

  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 })
  }

  // Validate and reserve stock for product variants
  const variantIds = [...new Set(items.map((i) => i.productVariantId).filter(Boolean))] as string[]
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
          return NextResponse.json({ error: "A product variant in your cart is no longer available." }, { status: 400 })
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

  const normalizedItems = items
    .map((item) => ({ item, sellerId: getSellerId(item) }))
    .filter((row): row is { item: CartItemForCheckout; sellerId: string } => !!row.sellerId)

  if (normalizedItems.length === 0) {
    return NextResponse.json({ error: "No seller-mapped items found in cart" }, { status: 400 })
  }

  const subtotal = normalizedItems.reduce((sum, row) => sum + row.item.totalPrice, 0)
  const tax = normalizedItems.reduce((sum, row) => sum + row.item.totalGst, 0)
  const shipping = 0
  const totalAmount = subtotal + tax + shipping
  const commission = totalAmount * (COMMISSION_RATE / 100)

  const sellerSubtotal = new Map<string, number>()
  for (const row of normalizedItems) {
    sellerSubtotal.set(row.sellerId, (sellerSubtotal.get(row.sellerId) ?? 0) + row.item.totalPrice)
  }
  const sellerShipping = new Map<string, number>()
  if (shipping > 0 && subtotal > 0) {
    let assigned = 0
    const entries = [...sellerSubtotal.entries()]
    entries.forEach(([sid, sub], idx) => {
      const value = idx === entries.length - 1 ? shipping - assigned : Number(((shipping * sub) / subtotal).toFixed(6))
      assigned += value
      sellerShipping.set(sid, value)
    })
  }

  const order = await prisma.order.create({
    data: {
      customerId: session.user.id,
      sellerId: null,
      status: "PENDING",
      totalAmount,
      subtotal,
      tax,
      shipping,
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

  for (const row of normalizedItems) {
    const { productName, serviceName } = getItemName(row.item)
    const lineTotalInclGst = row.item.totalPriceInclGst ?? row.item.totalPrice + row.item.totalGst
    const itemShippingAmount =
      subtotal > 0 ? Number((((sellerShipping.get(row.sellerId) ?? 0) * row.item.totalPrice) / (sellerSubtotal.get(row.sellerId) ?? 1)).toFixed(6)) : 0
    const itemCommissionAmount = (lineTotalInclGst + itemShippingAmount) * (COMMISSION_RATE / 100)

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
        subtotalInclGst: lineTotalInclGst,
        itemStatus: "PENDING",
        shippingAmount: itemShippingAmount,
        commissionAmount: itemCommissionAmount,
        commissionRateSnapshot: COMMISSION_RATE,
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

  await prisma.payment.create({
    data: {
      orderId: order.id,
      amount: totalAmount,
      status: "PENDING",
      method: "COD",
    },
  })

  await prisma.cartItem.deleteMany({
    where: { userId: session.user.id },
  })

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
      },
    ],
  }
  return NextResponse.json(response)
}
