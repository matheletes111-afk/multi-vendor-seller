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

/** POST /api/customer/checkout/place-order — create order(s) from cart (one per seller), COD. CUSTOMER only. */
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
  const items = cartItems as CartItemForCheckout[]

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

  const bySeller = new Map<string, typeof items>()
  for (const item of items) {
    const sid = getSellerId(item)
    if (!sid) continue
    let list = bySeller.get(sid)
    if (!list) {
      list = []
      bySeller.set(sid, list)
    }
    list.push(item)
  }

  const orderIds: string[] = []
  const ordersSummary: PlaceOrderResponse["orders"] = []

  for (const [sellerId, sellerItems] of bySeller) {
    const subtotal = sellerItems.reduce((s, i) => s + i.totalPrice, 0)
    const tax = sellerItems.reduce((s, i) => s + i.totalGst, 0)
    const totalAmount = subtotal + tax
    const commission = totalAmount * (COMMISSION_RATE / 100)

    const order = await prisma.order.create({
      data: {
        customerId: session.user.id,
        sellerId,
        status: "PENDING",
        totalAmount,
        subtotal,
        tax,
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

    for (const row of sellerItems) {
      const { productName, serviceName } = getItemName(row)
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: row.productId,
          productVariantId: row.productVariantId,
          serviceId: row.serviceId,
          servicePackageId: row.servicePackageId,
          serviceSlotId: row.serviceSlotId,
          productNameSnapshot: productName,
          serviceNameSnapshot: serviceName,
          quantity: row.quantity,
          price: row.unitPrice,
          subtotal: row.totalPrice,
          hasGst: row.hasGst,
          gstAmount: row.totalGst,
          subtotalInclGst: row.totalPriceInclGst ?? row.totalPrice + row.totalGst,
        },
      })
      // Reduce variant stock after order item is created
      if (row.productVariantId) {
        await prisma.productVariant.update({
          where: { id: row.productVariantId },
          data: { stock: { decrement: row.quantity } },
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

    orderIds.push(order.id)
    ordersSummary.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      sellerId,
      totalAmount,
      itemCount: sellerItems.length,
    })
  }

  await prisma.cartItem.deleteMany({
    where: { userId: session.user.id },
  })

  const response: PlaceOrderResponse = {
    success: true,
    orderIds,
    orders: ordersSummary,
  }
  return NextResponse.json(response)
}
