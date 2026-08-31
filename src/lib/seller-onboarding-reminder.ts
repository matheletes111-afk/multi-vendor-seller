import { prisma } from "@/lib/prisma"
import { evaluateSellerDocuments } from "@/lib/seller-approval-validation"
import { sendSellerOnboardingReminderEmail } from "@/lib/email"
import { getAppBaseUrl } from "@/lib/twilio-sms"

export interface OnboardingReminderOptions {
  dryRun?: boolean
  sellerType?: "ALL" | "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  limit?: number
  baseUrl?: string
  freeMonths?: number
}

export interface SellerReminderItem {
  id: string
  sellerType: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  userId: string
  userName: string | null
  userEmail: string | null
  businessName: string | null
  onboardingStep: number
  onboardingCompleted: boolean
  isApproved: boolean
  missingDocuments: string[]
  missingSteps: string[]
  onboardingUrl: string
  emailSent?: boolean
  error?: string
}

export interface OnboardingReminderSweepResult {
  success: boolean
  dryRun: boolean
  timestamp: string
  stats: {
    scannedTotal: number
    pendingTotal: number
    sentTotal: number
    failedTotal: number
    skippedNoEmail: number
    byType: {
      product: number
      service: number
      hotel: number
      restaurant: number
    }
  }
  sellers: SellerReminderItem[]
}

/**
 * Runs a sweep across all seller types to find sellers with incomplete onboarding
 * or pending verification documents, and sends them a promotional reminder email.
 */
export async function runSellerOnboardingReminderSweep(
  options: OnboardingReminderOptions = {}
): Promise<OnboardingReminderSweepResult> {
  const {
    dryRun = false,
    sellerType = "ALL",
    limit = 100,
    baseUrl,
    freeMonths = 2,
  } = options

  const effectiveBaseUrl = (
    baseUrl ||
    process.env.NEXT_PUBLIC_LIVE_SITE_URL?.trim() ||
    getAppBaseUrl()
  ).replace(/\/+$/, "")
  const normalizedType = sellerType.toUpperCase()

  const queryProduct = normalizedType === "ALL" || normalizedType === "PRODUCT"
  const queryService = normalizedType === "ALL" || normalizedType === "SERVICE"
  const queryHotel = normalizedType === "ALL" || normalizedType === "HOTEL"
  const queryRestaurant = normalizedType === "ALL" || normalizedType === "RESTAURANT"

  // Base where clause for pending / incomplete sellers
  const pendingWhere = {
    isSuspended: false,
    status: { not: "REJECTED" as const },
    OR: [
      { onboardingCompleted: false },
      { isApproved: false },
    ],
  }

  const [sellersRaw, hotelSellersRaw, restaurantSellersRaw] = await Promise.all([
    queryProduct || queryService
      ? prisma.seller.findMany({
          where: {
            ...pendingWhere,
            ...(normalizedType === "PRODUCT"
              ? { type: "PRODUCT" }
              : normalizedType === "SERVICE"
              ? { type: "SERVICE" }
              : {}),
          },
          include: {
            user: true,
            store: true,
            businessInfo: true,
            kyc: true,
            bankDetails: true,
            selectedCategories: true,
            selectedServiceCategories: true,
            agreement: true,
          },
          take: limit,
          orderBy: { createdAt: "desc" },
        })
      : [],
    queryHotel
      ? prisma.hotelSeller.findMany({
          where: pendingWhere,
          include: {
            user: true,
            businessInfo: true,
            kyc: true,
            bankDetails: true,
            agreement: true,
            hotels: true,
          },
          take: limit,
          orderBy: { createdAt: "desc" },
        })
      : [],
    queryRestaurant
      ? prisma.restaurantSeller.findMany({
          where: pendingWhere,
          include: {
            user: true,
            businessInfo: true,
            kyc: true,
            bankDetails: true,
            agreement: true,
            foods: true,
          },
          take: limit,
          orderBy: { createdAt: "desc" },
        })
      : [],
  ])

  const pendingList: SellerReminderItem[] = []
  let skippedNoEmail = 0

  // 1. Process Product and Service Sellers
  for (const s of sellersRaw) {
    const isProduct = s.type === "PRODUCT"
    const stType = isProduct ? "PRODUCT" : "SERVICE"
    const docEval = evaluateSellerDocuments(s, stType)
    const missingSteps: string[] = []

    if (!s.store?.name) missingSteps.push("Store Details & Setup")
    if (!s.businessInfo?.businessName) missingSteps.push("Business Details")
    if (!s.kyc?.idNumber && !s.kyc?.idType) missingSteps.push("Identity / KYC Verification")
    if (!s.bankDetails?.accountNumber && !s.bankDetails?.mobileMoneyOption) missingSteps.push("Bank / Payout Information")
    if (isProduct && (!s.selectedCategories || s.selectedCategories.length === 0)) {
      missingSteps.push("Product Category Selection")
    }
    if (!isProduct && (!s.selectedServiceCategories || s.selectedServiceCategories.length === 0)) {
      missingSteps.push("Service Category Selection")
    }
    if (!s.agreement?.agreedToTerms) missingSteps.push("Legal Agreement Acceptance")

    // Only include if onboarding is incomplete or documents are missing
    if (!s.onboardingCompleted || !docEval.isComplete || missingSteps.length > 0) {
      if (!s.user?.email) {
        skippedNoEmail++
        continue
      }
      pendingList.push({
        id: s.id,
        sellerType: stType,
        userId: s.userId,
        userName: s.user?.name || null,
        userEmail: s.user?.email || null,
        businessName: s.store?.name || s.businessInfo?.businessName || null,
        onboardingStep: s.onboardingStep || 2,
        onboardingCompleted: s.onboardingCompleted,
        isApproved: s.isApproved,
        missingDocuments: docEval.missingDocuments,
        missingSteps,
        onboardingUrl: `${effectiveBaseUrl}/${isProduct ? "product-seller" : "service-seller"}/onboarding`,
      })
    }
  }

  // 2. Process Hotel Sellers
  for (const h of hotelSellersRaw) {
    const docEval = evaluateSellerDocuments(h, "HOTEL")
    const missingSteps: string[] = []

    if (!h.businessInfo?.businessName) missingSteps.push("Hotel Business Information")
    if (!h.kyc?.idType) missingSteps.push("Identity / KYC Verification")
    if (!h.logo || !h.mainPhoto) missingSteps.push("Hotel Logo & Property Photos")
    if (!h.bankDetails?.accountNumber && !h.bankDetails?.mobileMoneyOption) missingSteps.push("Bank / Payout Details")
    if (!h.agreement?.agreedToTerms) missingSteps.push("Legal Agreement Acceptance")

    if (!h.onboardingCompleted || !docEval.isComplete || missingSteps.length > 0) {
      if (!h.user?.email) {
        skippedNoEmail++
        continue
      }
      pendingList.push({
        id: h.id,
        sellerType: "HOTEL",
        userId: h.userId,
        userName: h.user?.name || null,
        userEmail: h.user?.email || null,
        businessName: h.businessInfo?.businessName || h.hotels?.[0]?.name || null,
        onboardingStep: h.onboardingStep || 2,
        onboardingCompleted: h.onboardingCompleted,
        isApproved: h.isApproved,
        missingDocuments: docEval.missingDocuments,
        missingSteps,
        onboardingUrl: `${effectiveBaseUrl}/hotel-seller/onboarding`,
      })
    }
  }

  // 3. Process Restaurant Sellers
  for (const r of restaurantSellersRaw) {
    const docEval = evaluateSellerDocuments(r, "RESTAURANT")
    const missingSteps: string[] = []

    if (!r.businessInfo?.businessName) missingSteps.push("Restaurant Business Information")
    if (!r.kyc?.idType) missingSteps.push("Identity / KYC Verification")
    if (!r.kyc?.foodLicenseUrl && !r.kyc?.foodLicenseNumber) missingSteps.push("Food Sanitation / Hygiene License")
    if (!r.logo || !r.mainPhoto) missingSteps.push("Restaurant Logo & Culinary Photos")
    if (!r.bankDetails?.accountNumber && !r.bankDetails?.mobileMoneyOption) missingSteps.push("Bank / Payout Details")
    if (!r.agreement?.agreedToTerms) missingSteps.push("Legal Agreement Acceptance")

    if (!r.onboardingCompleted || !docEval.isComplete || missingSteps.length > 0) {
      if (!r.user?.email) {
        skippedNoEmail++
        continue
      }
      pendingList.push({
        id: r.id,
        sellerType: "RESTAURANT",
        userId: r.userId,
        userName: r.user?.name || null,
        userEmail: r.user?.email || null,
        businessName: r.businessInfo?.businessName || null,
        onboardingStep: r.onboardingStep || 2,
        onboardingCompleted: r.onboardingCompleted,
        isApproved: r.isApproved,
        missingDocuments: docEval.missingDocuments,
        missingSteps,
        onboardingUrl: `${effectiveBaseUrl}/restaurant-seller/onboarding`,
      })
    }
  }

  // Apply overall limit
  const selectedSellers = pendingList.slice(0, limit)

  let sentTotal = 0
  let failedTotal = 0

  if (!dryRun) {
    for (const seller of selectedSellers) {
      if (!seller.userEmail) continue
      try {
        const result = await sendSellerOnboardingReminderEmail({
          to: seller.userEmail,
          sellerName: seller.userName,
          businessName: seller.businessName,
          sellerType: seller.sellerType,
          onboardingUrl: seller.onboardingUrl,
          missingDocuments: seller.missingDocuments,
          missingSteps: seller.missingSteps,
          currentStep: seller.onboardingStep,
          freeMonths,
        })

        if (result.success) {
          seller.emailSent = true
          sentTotal++
        } else {
          seller.emailSent = false
          seller.error = result.error?.message || "Failed to send email"
          failedTotal++
        }
      } catch (err: any) {
        seller.emailSent = false
        seller.error = err?.message || String(err)
        failedTotal++
      }
    }
  }

  const byType = {
    product: selectedSellers.filter((s) => s.sellerType === "PRODUCT").length,
    service: selectedSellers.filter((s) => s.sellerType === "SERVICE").length,
    hotel: selectedSellers.filter((s) => s.sellerType === "HOTEL").length,
    restaurant: selectedSellers.filter((s) => s.sellerType === "RESTAURANT").length,
  }

  return {
    success: true,
    dryRun,
    timestamp: new Date().toISOString(),
    stats: {
      scannedTotal: sellersRaw.length + hotelSellersRaw.length + restaurantSellersRaw.length,
      pendingTotal: selectedSellers.length,
      sentTotal,
      failedTotal,
      skippedNoEmail,
      byType,
    },
    sellers: selectedSellers,
  }
}
