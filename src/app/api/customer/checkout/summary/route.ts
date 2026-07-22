import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const CHECKOUT_CART_INCLUDE = {
  product: {
    select: {
      sellerId: true,
      name: true,
      isActive: true,
      isDeleted: true,
      seller: {
        select: {
          id: true,
          store: { select: { name: true } },
        },
      },
    },
  },
  productVariant: { select: { name: true, weight: true } },
  service: {
    select: {
      sellerId: true,
      name: true,
      isActive: true,
      isDeleted: true,
      seller: {
        select: {
          id: true,
          store: { select: { name: true } },
        },
      },
    },
  },
  servicePackage: { select: { name: true } },
} as const

function getShippingChargeForWeight(weight: number, ranges: any[]): number {
  if (!ranges || ranges.length === 0) return 0
  const w = typeof weight === "number" && !isNaN(weight) ? Math.max(0, weight) : 0
  for (const r of ranges) {
    const minW = Number(r.minWeight ?? 0)
    const maxW = Number(r.maxWeight ?? 0)
    const charge = Number(r.charge ?? 0)
    if (w >= minW && w < maxW) {
      return charge
    }
  }
  const firstMin = Number(ranges[0]?.minWeight ?? 0)
  if (w <= firstMin) {
    return Number(ranges[0]?.charge ?? 0)
  }
  return Number(ranges[ranges.length - 1]?.charge ?? 0)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: CHECKOUT_CART_INCLUDE,
    orderBy: { createdAt: "asc" },
  })

  const items = cartItems.filter((i) => i.productId != null || i.serviceId != null)

  const globalSetting = await prisma.globalSetting.findFirst()
  const ranges = (globalSetting?.deliveryChargeRanges as any[]) || []

  // Group by seller
  const groupsMap = new Map<string, {
    sellerId: string
    sellerName: string
    items: typeof items
    totalWeight: number
    hasPhysicalProducts: boolean
  }>()

  const itemStoreNames: Record<string, string> = {}

  for (const item of items) {
    const seller = item.product?.seller ?? item.service?.seller
    const sellerId = seller?.id || item.product?.sellerId || item.service?.sellerId || "unknown"
    const sellerName = (seller as any)?.store?.name || "Vendor Store"

    itemStoreNames[item.id] = sellerName
    if (item.productId) itemStoreNames[item.productId] = sellerName

    if (!groupsMap.has(sellerId)) {
      groupsMap.set(sellerId, {
        sellerId,
        sellerName,
        items: [],
        totalWeight: 0,
        hasPhysicalProducts: false,
      })
    }

    const group = groupsMap.get(sellerId)!
    group.items.push(item)
    if (item.productId) {
      group.hasPhysicalProducts = true
      const weight = item.productVariant?.weight ?? 0
      group.totalWeight += weight * item.quantity
    }
  }

  let totalShipping = 0
  const sellerGroups = Array.from(groupsMap.values()).map((g) => {
    const sellerDeliveryFee = g.hasPhysicalProducts ? getShippingChargeForWeight(g.totalWeight, ranges) : 0
    totalShipping += sellerDeliveryFee
    return {
      sellerId: g.sellerId,
      sellerName: g.sellerName,
      itemsCount: g.items.length,
      sellerDeliveryFee,
      totalWeight: g.totalWeight,
    }
  })

  return NextResponse.json({
    shipping: totalShipping,
    sellerGroups,
    itemStoreNames,
    isMultiVendor: sellerGroups.length > 1,
    deliveryChargeRanges: ranges,
  })
}
