import { prisma } from "@/lib/prisma"
import { createFlotPaymentLink, verifyFlotPaymentAttempt } from "@/lib/flot"
import { validateSellerCoupon, recordSellerCouponUsage } from "@/lib/coupons"

export interface InitiateAdPaymentParams {
  adId: string
  totalBudget: number
  couponCode?: string | null
  userId: string
  paymentType?: "in-app" | "card" | "momo"
}

export interface InitiateAdPaymentResult {
  success: boolean
  requiresPayment: boolean
  paymentUrl: string | null
  orderId: string | null
  payableAmount: number
  couponDiscount: number
  error?: string
}

/**
 * Initialize ad payment workflow:
 * - Computes discount if coupon is supplied.
 * - If payable amount <= 0, automatically marks paymentStatus as COMPLETED.
 * - Otherwise generates a Float Payment Link, links order ID, and returns paymentUrl.
 */
export async function initiateAdPayment(
  params: InitiateAdPaymentParams
): Promise<InitiateAdPaymentResult> {
  const { adId, totalBudget, couponCode, userId, paymentType = "in-app" } = params

  let payableAmount = totalBudget
  let couponDiscount = 0
  let appliedCoupon: any = null

  // 1. Process Coupon if provided
  if (couponCode && couponCode.trim()) {
    const couponVal = await validateSellerCoupon({
      code: couponCode.trim(),
      amount: totalBudget,
      userId,
    })

    if (!couponVal.valid) {
      return {
        success: false,
        requiresPayment: true,
        paymentUrl: null,
        orderId: null,
        payableAmount: totalBudget,
        couponDiscount: 0,
        error: couponVal.error || "Invalid coupon code",
      }
    }

    couponDiscount = couponVal.discountAmount || 0
    payableAmount = couponVal.finalAmount != null ? couponVal.finalAmount : Math.max(0, totalBudget - couponDiscount)
    appliedCoupon = couponVal.coupon
  }

  // 2. Handle 100% discount / Zero payable amount
  if (payableAmount <= 0) {
    await prisma.sellerAd.update({
      where: { id: adId },
      data: {
        paymentStatus: "COMPLETED",
        paymentMethod: "COUPON_100_PERCENT",
        payableAmount: 0,
        paidAt: new Date(),
      },
    })

    if (appliedCoupon) {
      await recordSellerCouponUsage({
        couponId: appliedCoupon.id,
        userId,
        sellerAdId: adId,
      }).catch((e) => console.warn("[AdPayment] Error recording coupon usage:", e))
    }

    return {
      success: true,
      requiresPayment: false,
      paymentUrl: null,
      orderId: null,
      payableAmount: 0,
      couponDiscount,
    }
  }

  // 3. Initiate Float Hosted Payment
  const flotOrderId = `AD_${adId.slice(-8)}_${Date.now()}`

  try {
    const flotRes = await createFlotPaymentLink({
      orderId: flotOrderId,
      amount: payableAmount,
      currency: "SLE",
      type: paymentType,
    })

    await prisma.sellerAd.update({
      where: { id: adId },
      data: {
        paymentStatus: "PENDING",
        paymentMethod: "FLOAT",
        payableAmount,
        flotOrderId,
        flotInternalOrderId: flotRes.id,
        flotPaymentLink: flotRes.link,
      },
    })

    if (appliedCoupon) {
      await recordSellerCouponUsage({
        couponId: appliedCoupon.id,
        userId,
        sellerAdId: adId,
      }).catch((e) => console.warn("[AdPayment] Error recording coupon usage:", e))
    }

    return {
      success: true,
      requiresPayment: true,
      paymentUrl: flotRes.link,
      orderId: flotOrderId,
      payableAmount,
      couponDiscount,
    }
  } catch (error: any) {
    console.error("[AdPayment] Error creating Float payment link:", error)
    return {
      success: false,
      requiresPayment: true,
      paymentUrl: null,
      orderId: flotOrderId,
      payableAmount,
      couponDiscount,
      error: error?.message || "Failed to initialize Float payment gateway",
    }
  }
}

/**
 * Reconcile / Verify payment status with Float gateway.
 * Idempotently updates the database when status changes.
 */
export async function reconcileAdPayment(identifier: { adId?: string; orderId?: string }) {
  const where = identifier.adId
    ? { id: identifier.adId }
    : identifier.orderId
    ? { flotOrderId: identifier.orderId }
    : null

  if (!where) {
    return { success: false, error: "Missing ad identifier" }
  }

  const ad = await prisma.sellerAd.findFirst({
    where,
  })

  if (!ad) {
    return { success: false, error: "Ad not found" }
  }

  // If already marked completed, return current state
  if (ad.paymentStatus === "COMPLETED") {
    return {
      success: true,
      status: "COMPLETED",
      ad,
    }
  }

  // Check if we have Float identifiers to query
  if (!ad.flotOrderId || !ad.flotInternalOrderId) {
    return {
      success: true,
      status: ad.paymentStatus,
      ad,
    }
  }

  // Call Float Attempt Status API
  const attempt = await verifyFlotPaymentAttempt({
    externalOrderId: ad.flotOrderId,
    internalOrderId: ad.flotInternalOrderId,
  })

  if (!attempt) {
    return {
      success: true,
      status: ad.paymentStatus,
      ad,
      note: "No update from Float",
    }
  }

  if (attempt.status === "completed") {
    const updated = await prisma.sellerAd.update({
      where: { id: ad.id },
      data: {
        paymentStatus: "COMPLETED",
        paidAt: new Date(),
      },
    })
    return {
      success: true,
      status: "COMPLETED",
      ad: updated,
    }
  }

  if (attempt.status === "failed" && ad.paymentStatus !== "FAILED") {
    const updated = await prisma.sellerAd.update({
      where: { id: ad.id },
      data: {
        paymentStatus: "FAILED",
      },
    })
    return {
      success: true,
      status: "FAILED",
      ad: updated,
    }
  }

  return {
    success: true,
    status: ad.paymentStatus,
    ad,
  }
}

/**
 * Refresh or generate a new Float payment link for an unpaid or failed ad.
 */
export async function refreshAdPaymentLink(adId: string) {
  const ad = await prisma.sellerAd.findUnique({
    where: { id: adId },
  })

  if (!ad) {
    return { success: false, error: "Ad not found" }
  }

  if (ad.paymentStatus === "COMPLETED") {
    return { success: false, error: "Ad is already paid" }
  }

  const payableAmount = ad.payableAmount != null ? Number(ad.payableAmount) : Number(ad.totalBudget)
  const newOrderId = `AD_${ad.id.slice(-8)}_${Date.now()}`

  const flotRes = await createFlotPaymentLink({
    orderId: newOrderId,
    amount: payableAmount,
    currency: "SLE",
    type: "in-app",
  })

  const updated = await prisma.sellerAd.update({
    where: { id: ad.id },
    data: {
      flotOrderId: newOrderId,
      flotInternalOrderId: flotRes.id,
      flotPaymentLink: flotRes.link,
      paymentStatus: "PENDING",
    },
  })

  return {
    success: true,
    paymentUrl: flotRes.link,
    orderId: newOrderId,
    ad: updated,
  }
}
