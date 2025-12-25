"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCustomer } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function createOrder(data: {
  items: Array<{
    productId?: string
    serviceId?: string
    productVariantId?: string
    servicePackageId?: string
    serviceSlotId?: string
    quantity: number
    price: number
  }>
  shippingAddress: any
}) {
  const session = await auth()
  
  if (!session?.user || !isCustomer(session.user)) {
    return { error: "Unauthorized" }
  }

  if (data.items.length === 0) {
    return { error: "Order must have at least one item" }
  }

  // Calculate totals and group by seller
  const sellerOrders: Record<string, {
    sellerId: string
    items: typeof data.items
    subtotal: number
  }> = {}

  for (const item of data.items) {
    let sellerId: string

    if (item.productId) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { sellerId: true },
      })
      if (!product) return { error: "Product not found" }
      sellerId = product.sellerId
    } else if (item.serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: item.serviceId },
        select: { sellerId: true },
      })
      if (!service) return { error: "Service not found" }
      sellerId = service.sellerId
    } else {
      return { error: "Invalid item" }
    }

    if (!sellerOrders[sellerId]) {
      sellerOrders[sellerId] = {
        sellerId,
        items: [],
        subtotal: 0,
      }
    }

    sellerOrders[sellerId].items.push(item)
    sellerOrders[sellerId].subtotal += item.price * item.quantity
  }

  // Create orders for each seller
  const orders = []
  for (const [sellerId, sellerOrder] of Object.entries(sellerOrders)) {
    // Get category for commission calculation
    const firstItem = sellerOrder.items[0]
    let categoryId: string | null = null

    if (firstItem.productId) {
      const product = await prisma.product.findUnique({
        where: { id: firstItem.productId },
        select: { categoryId: true },
      })
      categoryId = product?.categoryId || null
    } else if (firstItem.serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: firstItem.serviceId },
        select: { categoryId: true },
      })
      categoryId = service?.categoryId || null
    }

    const category = categoryId ? await prisma.category.findUnique({
      where: { id: categoryId },
      select: { commissionRate: true },
    }) : null

    const commissionRate = category?.commissionRate || 10.0
    const commission = sellerOrder.subtotal * (commissionRate / 100)
    const totalAmount = sellerOrder.subtotal + commission

    const order = await prisma.order.create({
      data: {
        customerId: session.user.id,
        sellerId,
        status: "PENDING",
        subtotal: sellerOrder.subtotal,
        totalAmount,
        commission,
        commissionRate,
        shippingAddress: data.shippingAddress,
        items: {
          create: sellerOrder.items.map(item => ({
            productId: item.productId,
            serviceId: item.serviceId,
            productVariantId: item.productVariantId,
            servicePackageId: item.servicePackageId,
            serviceSlotId: item.serviceSlotId,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.price * item.quantity,
          })),
        },
      },
      include: {
        items: true,
      },
    })

    // Create commission record
    await prisma.commission.create({
      data: {
        orderId: order.id,
        sellerId,
        amount: commission,
        rate: commissionRate,
      },
    })

    orders.push(order)
  }

  // Clear cart
  await prisma.cartItem.deleteMany({
    where: { userId: session.user.id },
  })

  revalidatePath("/dashboard/customer/orders")
  return { success: true, orders }
}

