import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateShippingBreakup, getRegionDeliveryChargeDetails } from "@/lib/shipping-calculator"

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
  productVariant: { select: { name: true, weight: true, height: true, width: true, depth: true } },
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

  const globalSetting = await prisma.globalSetting.findFirst({ select: { deliveryChargeRanges: true, dimensionDeliveryChargeRanges: true, regionDeliveryCharges: true } }).catch(() => null)
  const weightRanges = (globalSetting?.deliveryChargeRanges as any[]) || []
  const dimensionRanges = (globalSetting?.dimensionDeliveryChargeRanges as any[]) || []
  const regionCharges = (globalSetting?.regionDeliveryCharges as any[]) || []

  const searchParams = req.nextUrl.searchParams
  const addressId = searchParams.get("addressId")

  let addressState = ""
  if (addressId) {
    const addr = await prisma.userAddress.findFirst({ where: { id: addressId, userId: session.user.id } })
    addressState = addr?.state || ""
  } else {
    const addr = await prisma.userAddress.findFirst({ where: { userId: session.user.id, isDefault: true } })
    addressState = addr?.state || ""
  }

  // Resolve matched region name and zone for display in Delivery Breakdown UI
  const regionDetails = getRegionDeliveryChargeDetails(addressState, regionCharges)

  // Group by seller
  const groupsMap = new Map<string, {
    sellerId: string
    sellerName: string
    items: typeof items
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
      })
    }

    const group = groupsMap.get(sellerId)!
    group.items.push(item)
  }

  let totalWeightShippingFee = 0
  let totalDimensionShippingFee = 0
  let totalRegionShippingFee = 0
  let totalShipping = 0

  const sellerGroups = Array.from(groupsMap.values()).map((g) => {
    const shippingItems = g.items.map((item) => ({
      weight: item.productVariant?.weight ?? 0,
      height: item.productVariant?.height ?? 0,
      width: item.productVariant?.width ?? 0,
      depth: item.productVariant?.depth ?? 0,
      quantity: item.quantity,
      isPhysical: item.productId != null,
    }))

    const breakup = calculateShippingBreakup({
      items: shippingItems,
      destinationState: addressState,
      weightRanges,
      dimensionRanges,
      regionCharges,
    })

    totalWeightShippingFee += breakup.weightShippingFee
    totalDimensionShippingFee += breakup.dimensionShippingFee
    totalRegionShippingFee += breakup.regionShippingFee
    totalShipping += breakup.totalShippingFee

    return {
      sellerId: g.sellerId,
      sellerName: g.sellerName,
      itemsCount: g.items.length,
      sellerDeliveryFee: breakup.totalShippingFee,
      shippingBreakup: breakup,
    }
  })

  return NextResponse.json({
    shipping: totalShipping,
    shippingBreakup: {
      weightShippingFee: totalWeightShippingFee,
      dimensionShippingFee: totalDimensionShippingFee,
      regionShippingFee: totalRegionShippingFee,
      totalShippingFee: totalShipping,
      // Region name and zone resolved from address.state for Delivery Breakdown display
      matchedRegionName: regionDetails.matchedRegionName,
      matchedZoneName: regionDetails.matchedZoneName,
    },
    regionFee: totalRegionShippingFee,
    sellerGroups,
    itemStoreNames,
    isMultiVendor: sellerGroups.length > 1,
    deliveryChargeRanges: weightRanges,
    dimensionDeliveryChargeRanges: dimensionRanges,
    regionDeliveryCharges: regionCharges,
  })
}
