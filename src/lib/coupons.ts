import { prisma } from "@/lib/prisma"

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
    return { valid: false, error: `This coupon is only valid for ${coupon.type.toLowerCase()} orders` }
  }

  // Calculate matching items subtotal if categoryId is set
  let applicableSubtotal = subtotal
  if (coupon.categoryId) {
    const productIds = items.filter(i => i.productId).map(i => i.productId!)
    const serviceIds = items.filter(i => i.serviceId).map(i => i.serviceId!)

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

    const matchingItems = items.filter(
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
    return { valid: false, error: `Minimum order value of NLe ${coupon.minOrderValue.toFixed(2)} not met for this coupon` }
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
