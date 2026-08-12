import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { calculateShippingBreakup, getRegionDeliveryCharge } from "@/lib/shipping-calculator"

export const dynamic = "force-dynamic"

const CHECKOUT_CART_INCLUDE = {
  product: {
    select: {
      sellerId: true,
      name: true,
      isDeleted: true,
      seller: { select: { id: true, store: { select: { name: true } } } },
    },
  },
  productVariant: { select: { name: true, weight: true, height: true, width: true, depth: true } },
  service: {
    select: {
      sellerId: true,
      name: true,
      isDeleted: true,
      seller: { select: { id: true, store: { select: { name: true } } } },
    },
  },
  servicePackage: { select: { name: true } },
} as const

/**
 * GET /mobileapi/customer/checkout/summary
 * Query params:
 *   - addressId (optional): ID of the delivery address to compute region charges against
 *
 * Returns shipping breakup (weight, dimension, region fees) for the authenticated
 * customer's current cart. Region charge is applied once per order (not per seller).
 */
export async function GET(request: NextRequest) {
  const auth = await getMobileCustomerAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: "Unauthorized. Valid customer token required." }, { status: 401 })
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: auth.userId },
    include: CHECKOUT_CART_INCLUDE,
    orderBy: { createdAt: "asc" },
  })

  const items = cartItems.filter((i) => i.productId != null || i.serviceId != null)

  const globalSetting = await prisma.globalSetting.findFirst({
    select: { deliveryChargeRanges: true, dimensionDeliveryChargeRanges: true, regionDeliveryCharges: true },
  }).catch(() => null)

  const weightRanges = (globalSetting?.deliveryChargeRanges as any[]) || []
  const dimensionRanges = (globalSetting?.dimensionDeliveryChargeRanges as any[]) || []
  const regionCharges = (globalSetting?.regionDeliveryCharges as any[]) || []

  // Determine destination state from address
  const searchParams = request.nextUrl.searchParams
  const addressId = searchParams.get("addressId")

  let addressState = ""
  if (addressId) {
    const addr = await prisma.userAddress.findFirst({ where: { id: addressId, userId: auth.userId } })
    addressState = addr?.state || ""
  } else {
    const addr = await prisma.userAddress.findFirst({ where: { userId: auth.userId, isDefault: true } })
    addressState = addr?.state || ""
  }

  // Group cart items by seller
  const groupsMap = new Map<string, { sellerId: string; sellerName: string; items: typeof items }>()

  for (const item of items) {
    const seller = (item as any).product?.seller ?? (item as any).service?.seller
    const sellerId = seller?.id || (item as any).product?.sellerId || (item as any).service?.sellerId || "unknown"
    const sellerName = seller?.store?.name || "Vendor Store"

    if (!groupsMap.has(sellerId)) {
      groupsMap.set(sellerId, { sellerId, sellerName, items: [] })
    }
    groupsMap.get(sellerId)!.items.push(item)
  }

  let totalWeightShippingFee = 0
  let totalDimensionShippingFee = 0
  let totalPhysicalBaseFee = 0

  const sellerGroups = Array.from(groupsMap.values()).map((g) => {
    const shippingItems = g.items.map((item) => ({
      weight: (item as any).productVariant?.weight ?? 0,
      height: (item as any).productVariant?.height ?? 0,
      width: (item as any).productVariant?.width ?? 0,
      depth: (item as any).productVariant?.depth ?? 0,
      quantity: item.quantity,
      isPhysical: item.productId != null,
    }))

    // Region charge is per-order, not per-seller � pass empty array here
    const breakup = calculateShippingBreakup({
      items: shippingItems,
      destinationState: addressState,
      weightRanges,
      dimensionRanges,
      regionCharges: [],
    })

    totalWeightShippingFee += breakup.weightShippingFee
    totalDimensionShippingFee += breakup.dimensionShippingFee
    totalPhysicalBaseFee += breakup.totalShippingFee

    return {
      sellerId: g.sellerId,
      sellerName: g.sellerName,
      itemsCount: g.items.length,
      sellerDeliveryFee: breakup.totalShippingFee,
      shippingBreakup: {
        weightShippingFee: breakup.weightShippingFee,
        dimensionShippingFee: breakup.dimensionShippingFee,
        regionShippingFee: 0,
        totalShippingFee: breakup.totalShippingFee,
      },
    }
  })

  // Region fee is a flat per-order charge  apply once
  const regionShippingFee = getRegionDeliveryCharge(addressState, regionCharges)
  // totalPhysicalBaseFee = sum of (weightFee + dimFee) per seller — additive formula
  const totalShippingFee = totalPhysicalBaseFee + regionShippingFee

  return NextResponse.json({
    success: true,
    shipping: totalShippingFee,
    shippingBreakup: {
      weightShippingFee: totalWeightShippingFee,
      dimensionShippingFee: totalDimensionShippingFee,
      regionShippingFee,
      totalShippingFee,
    },
    sellerGroups,
    isMultiVendor: sellerGroups.length > 1,
  })
}
