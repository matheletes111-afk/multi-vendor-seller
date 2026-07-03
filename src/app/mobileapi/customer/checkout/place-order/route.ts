import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { allocateNextOrderNumberTx } from "@/lib/order-number"
import type { PlaceOrderResponse } from "@/app/api/customer/checkout/types"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { UserRole } from "@prisma/client"
import { sendOrderConfirmationEmail, sendSellerNewOrderEmail, sendAdminNewOrderEmail } from "@/lib/email"

export const dynamic = "force-dynamic"

const CHECKOUT_CART_INCLUDE = {
  product: { select: { sellerId: true, name: true, isDeleted: true } },
  productVariant: { select: { name: true } },
  service: { select: { sellerId: true, name: true, isDeleted: true } },
  servicePackage: { select: { name: true } },
} as const

type CartItemForCheckout = Awaited<
  ReturnType<typeof prisma.cartItem.findMany<{ include: typeof CHECKOUT_CART_INCLUDE }>>
>[number] & {
  unitPrice: number
  totalPrice: number
  hasGst: boolean
  totalGst: number
  totalPriceInclGst: number | null
}

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized. Valid customer token required." }, { status: 401 })
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

const COMMISSION_RATE = 10

/** POST /mobileapi/customer/checkout/place-order — create one order with item-level seller ownership. Auth: Bearer token (customer). */
export async function POST(request: NextRequest) {
  const auth = await getMobileCustomerAuth(request)
  if (!auth.ok) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }

  const payload = body as { addressId?: string }
  const addressId = typeof payload.addressId === "string" ? payload.addressId.trim() : null
  if (!addressId) {
    return NextResponse.json({ success: false, error: "addressId required" }, { status: 400 })
  }

  const address = await prisma.userAddress.findFirst({
    where: { id: addressId, userId: auth.userId },
  })
  if (!address) {
    return NextResponse.json({ success: false, error: "Address not found" }, { status: 404 })
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: auth.userId },
    include: CHECKOUT_CART_INCLUDE,
    orderBy: { createdAt: "asc" },
  })
  const items = cartItems as CartItemForCheckout[]

  if (items.length === 0) {
    return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 })
  }

  // Double check that No products/services in cart were recently deleted
  for (const item of items) {
    if (item.productId && (!item.product || (item.product as any).isDeleted)) {
      return NextResponse.json(
        { success: false, error: `Product "${item.product?.name || 'Unknown'}" is no longer available.` },
        { status: 400 }
      )
    }
    if (item.serviceId && (!item.service || (item.service as any).isDeleted)) {
      return NextResponse.json(
        { success: false, error: `Service "${item.service?.name || 'Unknown'}" is no longer available.` },
        { status: 400 }
      )
    }
  }

  // Validate stock for product variants
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
          return NextResponse.json(
            { success: false, error: "A product variant in your cart is no longer available." },
            { status: 400 }
          )
        }
        if (v.stock < item.quantity) {
          return NextResponse.json(
            {
              success: false,
              error: `Insufficient stock for \"${v.name}\". Available: ${v.stock}, requested: ${item.quantity}.`,
            },
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
    return NextResponse.json({ success: false, error: "No seller-mapped items found in cart" }, { status: 400 })
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

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await allocateNextOrderNumberTx(tx)
    return tx.order.create({
      data: {
        orderNumber,
        customerId: auth.userId,
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
  })

  for (const row of normalizedItems) {
    const { productName, serviceName } = getItemName(row.item)
    const lineTotalInclGst = row.item.totalPriceInclGst ?? row.item.totalPrice + row.item.totalGst
    const itemShippingAmount =
      subtotal > 0 ? Number((((sellerShipping.get(row.sellerId) ?? 0) * row.item.totalPrice) / (sellerSubtotal.get(row.sellerId) ?? 1)).toFixed(6)) : 0
    const itemCommissionAmount = (lineTotalInclGst + itemShippingAmount) * (COMMISSION_RATE / 100)

    await prisma.orderItem.create({
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

    if (row.item.productVariantId) {
      await prisma.productVariant.update({
        where: { id: row.item.productVariantId },
        data: { stock: { decrement: row.item.quantity } },
      })
    }
  }

  await prisma.payment.create({
    data: { orderId: order.id, amount: totalAmount, status: "PENDING", method: "COD" },
  })

  await prisma.cartItem.deleteMany({ where: { userId: auth.userId } })

  // ── Send Email Notifications ───────────────────────────────────────────────
  try {
    const customerUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true, name: true },
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

      // Send Customer Email
      await sendOrderConfirmationEmail({
        to: customerUser.email,
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

      // Send Seller Emails
      const uniqueSellerIds = [...new Set(normalizedItems.map((n) => n.sellerId))]
      const sellers = await prisma.seller.findMany({
        where: { id: { in: uniqueSellerIds } },
        include: {
          user: { select: { email: true, name: true } },
          store: { select: { name: true } },
        },
      })

      for (const seller of sellers) {
        if (seller.user?.email) {
          const sellerItems = emailItems.filter((i) => i.sellerId === seller.id)
          await sendSellerNewOrderEmail({
            to: seller.user.email,
            sellerName: seller.store?.name ?? seller.user.name ?? "Seller",
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
        select: { email: true },
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

