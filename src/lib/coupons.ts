import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"

export interface CouponItem {
  productId?: string
  serviceId?: string
  foodItemId?: string
  categoryId?: string // product category or service category or food category
  price: number
  quantity: number
}

export async function validateCoupon(params: {
  code: string
  type: "PRODUCT" | "SERVICE" | "HOTEL" | "FOOD"
  subtotal: number
  items: CouponItem[]
  userId: string
}) {
  const { code, type, subtotal, items, userId } = params

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      usages: true
    }
  })

  if (!coupon) {
    return { valid: false, error: "Coupon not found" }
  }

  if (!coupon.isActive) {
    return { valid: false, error: "Coupon is inactive" }
  }

  const now = new Date()
  if (now < coupon.startDate || now > coupon.endDate) {
    return { valid: false, error: "Coupon is expired or not yet active" }
  }

  if (coupon.type !== type) {
    if (coupon.type === "SELLER" && (type === ("SELLER" as any) || type === ("SUBSCRIPTION" as any) || type === ("AD" as any))) {
      // Allow SELLER coupons for seller subscription or ad requests
    } else {
      return { valid: false, error: `This coupon is only valid for ${coupon.type.toLowerCase()} orders` }
    }
  }

  const isHotelOrSeller = coupon.type === "HOTEL" || coupon.type === "SELLER"

  // Filter items matching the coupon type if items array was provided with items
  let typeMatchingItems: CouponItem[] = []
  if (items && items.length > 0 && !isHotelOrSeller) {
    typeMatchingItems = items.filter(i => {
      if (coupon.type === "PRODUCT") return i.productId != null
      if (coupon.type === "SERVICE") return i.serviceId != null
      if (coupon.type === "FOOD") return i.foodItemId != null
      return true
    })

    if (typeMatchingItems.length === 0) {
      return { valid: false, error: `This coupon is only valid for ${coupon.type.toLowerCase()} items` }
    }
  }

  // Calculate matching items subtotal
  let applicableSubtotal = typeMatchingItems.length > 0
    ? typeMatchingItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    : subtotal

  if (coupon.categoryId) {
    const productIds = typeMatchingItems.filter(i => i.productId).map(i => i.productId!)
    const serviceIds = typeMatchingItems.filter(i => i.serviceId).map(i => i.serviceId!)

    const [dbProducts, dbServices] = await Promise.all([
      productIds.length > 0
        ? prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, categoryId: true }
          })
        : [],
      serviceIds.length > 0
        ? prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, serviceCategoryId: true }
          })
        : []
    ])

    const matchingProductIds = dbProducts.filter((p: { id: string; categoryId: string }) => p.categoryId === coupon.categoryId).map((p: { id: string }) => p.id)
    const matchingServiceIds = dbServices.filter((s: { id: string; serviceCategoryId: string | null }) => s.serviceCategoryId === coupon.categoryId).map((s: { id: string }) => s.id)

    const matchingItems = typeMatchingItems.filter(
      item =>
        (item.productId && matchingProductIds.includes(item.productId)) ||
        (item.serviceId && matchingServiceIds.includes(item.serviceId))
    )

    if (matchingItems.length === 0) {
      return { valid: false, error: "Coupon is not applicable to the items in your cart" }
    }
    applicableSubtotal = matchingItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }

  if (applicableSubtotal < coupon.minOrderValue) {
    return { valid: false, error: `Minimum order value of ${formatCurrency(coupon.minOrderValue)} not met for this coupon` }
  }

  // Global usage limit check
  if (coupon.customerCount !== null) {
    const totalUsages = coupon.usages.length
    if (totalUsages >= coupon.customerCount) {
      return { valid: false, error: "Coupon usage limit reached" }
    }
  }

  // Per-customer usage limit check
  const userUsages = coupon.usages.filter((usage: { userId: string }) => usage.userId === userId).length
  if (userUsages >= coupon.maxUsesPerCustomer) {
    return { valid: false, error: `You have already used this coupon the maximum allowed times (${coupon.maxUsesPerCustomer})` }
  }

  // Calculate discount amount
  let discountAmount = 0
  if (coupon.discountType === "PERCENTAGE") {
    discountAmount = (applicableSubtotal * coupon.discountValue) / 100
  } else {
    // FIXED
    discountAmount = Math.min(coupon.discountValue, applicableSubtotal)
  }

  return {
    valid: true,
    coupon,
    discountAmount
  }
}

export async function validateSellerCoupon(params: {
  code: string
  amount: number
  userId: string
}) {
  const { code, amount, userId } = params

  if (!code || !code.trim()) {
    return { valid: false, error: "Coupon code is required" }
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: {
      usages: true
    }
  })

  if (!coupon) {
    return { valid: false, error: "Coupon not found" }
  }

  if (!coupon.isActive) {
    return { valid: false, error: "Coupon is inactive" }
  }

  const now = new Date()
  if (now < coupon.startDate || now > coupon.endDate) {
    return { valid: false, error: "Coupon is expired or not yet active" }
  }

  if (coupon.type !== "SELLER") {
    return { valid: false, error: "This coupon is not valid for seller promotions or subscriptions" }
  }

  if (amount < coupon.minOrderValue) {
    return { valid: false, error: `Minimum amount of ${formatCurrency(coupon.minOrderValue)} required for this coupon` }
  }

  // Global count check
  if (coupon.customerCount !== null) {
    const totalUsages = coupon.usages.length
    if (totalUsages >= coupon.customerCount) {
      return { valid: false, error: "Coupon usage limit reached" }
    }
  }

  // Per-seller usage limit check
  const sellerUsages = coupon.usages.filter((usage: { userId: string }) => usage.userId === userId).length
  if (sellerUsages >= coupon.maxUsesPerCustomer) {
    return { valid: false, error: `You have already used this coupon the maximum allowed times (${coupon.maxUsesPerCustomer})` }
  }

  // Calculate discount amount
  let discountAmount = 0
  if (coupon.discountType === "PERCENTAGE") {
    discountAmount = (amount * coupon.discountValue) / 100
  } else {
    // FIXED
    discountAmount = Math.min(coupon.discountValue, amount)
  }

  const finalAmount = Math.max(0, amount - discountAmount)

  return {
    valid: true,
    coupon,
    discountAmount,
    finalAmount
  }
}

export async function recordSellerCouponUsage(params: {
  couponId: string
  userId: string
  sellerAdId?: string
  subscriptionId?: string
  prismaTx?: any
}) {
  const { couponId, userId, sellerAdId, subscriptionId, prismaTx } = params
  const client = prismaTx || prisma

  return await client.couponUsage.create({
    data: {
      couponId,
      userId,
      sellerAdId: sellerAdId || null,
      subscriptionId: subscriptionId || null,
    }
  })
}

