import { prisma } from "@/lib/prisma"
import { sendSellerDripEmail } from "@/lib/email"
import { getDefaultDripTemplate, DripTemplateItem } from "@/lib/seller-drip-defaults"

export interface SellerDailyDripOptions {
  dryRun?: boolean
  limit?: number
  sellerType?: "ALL" | "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  sellerIds?: string[]
  baseUrl?: string
}

export interface SellerDripItemResult {
  sellerId: string
  sellerType: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  userName: string | null
  businessName: string | null
  userEmail: string | null
  dayNumber: number
  subject: string
  headline: string
  status: "SENT" | "SKIPPED_ALREADY_SENT_TODAY" | "SKIPPED_CYCLE_COMPLETED" | "SKIPPED_INACTIVE" | "FAILED"
  error?: string
}

export interface SellerDailyDripSweepResult {
  success: boolean
  dryRun: boolean
  timestamp: string
  stats: {
    scannedActiveSellers: number
    processedCount: number
    sentCount: number
    failedCount: number
    skippedAlreadySentToday: number
    skippedCycleCompleted: number
    skippedInactive: number
    byType: {
      product: number
      service: number
      hotel: number
      restaurant: number
    }
  }
  items: SellerDripItemResult[]
}

/**
 * Runs the Daily Seller Drip Campaign for verified & active sellers who have completed onboarding.
 * Progresses each seller through Days 1 to 7 with exactly one personalized email per day.
 */
export async function runSellerDailyDripSweep(
  options: SellerDailyDripOptions = {}
): Promise<SellerDailyDripSweepResult> {
  const {
    dryRun = false,
    limit = 100,
    sellerType = "ALL",
    sellerIds,
    baseUrl,
  } = options

  const normalizedType = sellerType.toUpperCase()
  const queryProduct = normalizedType === "ALL" || normalizedType === "PRODUCT"
  const queryService = normalizedType === "ALL" || normalizedType === "SERVICE"
  const queryHotel = normalizedType === "ALL" || normalizedType === "HOTEL"
  const queryRestaurant = normalizedType === "ALL" || normalizedType === "RESTAURANT"

  // Base where clause: MUST BE ACTIVE, ONBOARDING COMPLETED, APPROVED, NOT SUSPENDED
  const activeWhere: any = {
    onboardingCompleted: true,
    isApproved: true,
    isSuspended: false,
    status: { not: "REJECTED" as const },
    ...(sellerIds && sellerIds.length > 0 ? { id: { in: sellerIds } } : {}),
  }

  // 1. Fetch active sellers across all 4 categories
  const [productAndServiceSellers, hotelSellers, restaurantSellers] = await Promise.all([
    queryProduct || queryService
      ? prisma.seller.findMany({
          where: {
            ...activeWhere,
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
          },
          orderBy: { createdAt: "desc" },
          take: 2000,
        })
      : [],
    queryHotel
      ? prisma.hotelSeller.findMany({
          where: activeWhere,
          include: {
            user: true,
            hotels: true,
            businessInfo: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1000,
        })
      : [],
    queryRestaurant
      ? prisma.restaurantSeller.findMany({
          where: activeWhere,
          include: {
            user: true,
            businessInfo: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1000,
        })
      : [],
  ])

  // Normalise into standard candidate array
  interface Candidate {
    id: string
    sellerType: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
    email: string | null
    name: string | null
    businessName: string | null
  }

  const candidates: Candidate[] = []

  for (const s of productAndServiceSellers) {
    if (s.user?.email) {
      candidates.push({
        id: s.id,
        sellerType: s.type === "SERVICE" ? "SERVICE" : "PRODUCT",
        email: s.user.email,
        name: s.user.name || null,
        businessName: s.store?.name || s.businessInfo?.businessName || null,
      })
    }
  }

  for (const h of hotelSellers) {
    if (h.user?.email) {
      candidates.push({
        id: h.id,
        sellerType: "HOTEL",
        email: h.user.email,
        name: h.user.name || null,
        businessName: h.hotels?.[0]?.name || h.businessInfo?.businessName || null,
      })
    }
  }

  for (const r of restaurantSellers) {
    if (r.user?.email) {
      candidates.push({
        id: r.id,
        sellerType: "RESTAURANT",
        email: r.user.email,
        name: r.user.name || null,
        businessName: r.businessInfo?.businessName || null,
      })
    }
  }

  // 2. Fetch all existing drip templates from database for fast in-memory lookup
  const dbTemplates = await prisma.sellerDripTemplate.findMany()
  const templateMap = new Map<string, any>()
  for (const t of dbTemplates) {
    templateMap.set(`${t.sellerType}_${t.dayNumber}`, t)
  }

  // 3. Fetch recent drip logs for all candidates
  const candidateIds = candidates.map((c) => c.id)
  const logs = candidateIds.length > 0
    ? await prisma.sellerDripLog.findMany({
        where: { sellerId: { in: candidateIds } },
        orderBy: { sentAt: "desc" },
      })
    : []

  const logsBySeller = new Map<string, typeof logs>()
  for (const l of logs) {
    const list = logsBySeller.get(l.sellerId) || []
    list.push(l)
    logsBySeller.set(l.sellerId, list)
  }

  const items: SellerDripItemResult[] = []
  let sentCount = 0
  let failedCount = 0
  let skippedAlreadySentToday = 0
  let skippedCycleCompleted = 0
  let skippedInactive = 0

  const now = Date.now()
  const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000

  // 4. Process candidates up to limit
  for (const c of candidates) {
    if (sentCount >= limit) break

    const sellerLogs = logsBySeller.get(c.id) || []
    const sentDays = new Set(sellerLogs.filter((l) => l.status === "SENT").map((l) => l.dayNumber))

    // Check if seller already received an email today (within last 20 hours)
    const latestSentLog = sellerLogs
      .filter((l) => l.status === "SENT")
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0]

    if (latestSentLog && now - latestSentLog.sentAt.getTime() < TWENTY_HOURS_MS) {
      skippedAlreadySentToday++
      continue
    }

    // Continuous 7-Day Loop: Day 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 1 -> 2 ...
    let nextDayNumber = 1
    if (latestSentLog) {
      nextDayNumber = (latestSentLog.dayNumber % 7) + 1
    }

    // Fetch template from DB or default
    const dbTpl = templateMap.get(`${c.sellerType}_${nextDayNumber}`)
    const fallbackTpl = getDefaultDripTemplate(c.sellerType, nextDayNumber)

    const tpl: DripTemplateItem = {
      sellerType: c.sellerType,
      dayNumber: nextDayNumber,
      subject: dbTpl?.subject || fallbackTpl.subject,
      preheader: dbTpl?.preheader || fallbackTpl.preheader,
      headline: dbTpl?.headline || fallbackTpl.headline,
      body: dbTpl?.body || fallbackTpl.body,
      bulletPoints: Array.isArray(dbTpl?.bulletPoints)
        ? (dbTpl.bulletPoints as string[])
        : fallbackTpl.bulletPoints,
      ctaText: dbTpl?.ctaText || fallbackTpl.ctaText,
      ctaUrl: dbTpl?.ctaUrl || fallbackTpl.ctaUrl,
      isActive: dbTpl ? dbTpl.isActive : true,
    }

    if (tpl.isActive === false) {
      skippedInactive++
      items.push({
        sellerId: c.id,
        sellerType: c.sellerType,
        userName: c.name,
        businessName: c.businessName,
        userEmail: c.email,
        dayNumber: nextDayNumber,
        subject: tpl.subject,
        headline: tpl.headline,
        status: "SKIPPED_INACTIVE",
      })
      continue
    }

    // Process send
    if (dryRun) {
      sentCount++
      items.push({
        sellerId: c.id,
        sellerType: c.sellerType,
        userName: c.name,
        businessName: c.businessName,
        userEmail: c.email,
        dayNumber: nextDayNumber,
        subject: tpl.subject,
        headline: tpl.headline,
        status: "SENT",
      })
    } else {
      try {
        const sendResult = await sendSellerDripEmail({
          to: c.email,
          sellerName: c.name,
          businessName: c.businessName,
          sellerType: c.sellerType,
          dayNumber: nextDayNumber,
          subject: tpl.subject,
          preheader: tpl.preheader,
          headline: tpl.headline,
          body: tpl.body,
          bulletPoints: tpl.bulletPoints,
          ctaText: tpl.ctaText,
          ctaUrl: tpl.ctaUrl,
          baseUrl,
        })

        if (sendResult.success) {
          sentCount++
          await prisma.sellerDripLog.create({
            data: {
              sellerId: c.id,
              sellerType: c.sellerType,
              dayNumber: nextDayNumber,
              recipientEmail: c.email!,
              templateId: dbTpl?.id || null,
              status: "SENT",
            },
          })

          items.push({
            sellerId: c.id,
            sellerType: c.sellerType,
            userName: c.name,
            businessName: c.businessName,
            userEmail: c.email,
            dayNumber: nextDayNumber,
            subject: tpl.subject,
            headline: tpl.headline,
            status: "SENT",
          })
        } else {
          failedCount++
          const errorMsg = ("error" in sendResult && (sendResult.error as any)?.message) || "Failed to send email"
          await prisma.sellerDripLog.create({
            data: {
              sellerId: c.id,
              sellerType: c.sellerType,
              dayNumber: nextDayNumber,
              recipientEmail: c.email!,
              templateId: dbTpl?.id || null,
              status: "FAILED",
              error: errorMsg,
            },
          })

          items.push({
            sellerId: c.id,
            sellerType: c.sellerType,
            userName: c.name,
            businessName: c.businessName,
            userEmail: c.email,
            dayNumber: nextDayNumber,
            subject: tpl.subject,
            headline: tpl.headline,
            status: "FAILED",
            error: errorMsg,
          })
        }
      } catch (err: any) {
        failedCount++
          items.push({
            sellerId: c.id,
            sellerType: c.sellerType,
            userName: c.name,
            businessName: c.businessName,
            userEmail: c.email,
            dayNumber: nextDayNumber,
            subject: tpl.subject,
            headline: tpl.headline,
            status: "FAILED",
            error: err?.message || String(err),
          })
        }

        // Polite 50ms pause between live sends to prevent ISP/SendGrid burst rate-limiting
        if (!dryRun) {
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      }
  }

  const byType = {
    product: items.filter((i) => i.sellerType === "PRODUCT" && i.status === "SENT").length,
    service: items.filter((i) => i.sellerType === "SERVICE" && i.status === "SENT").length,
    hotel: items.filter((i) => i.sellerType === "HOTEL" && i.status === "SENT").length,
    restaurant: items.filter((i) => i.sellerType === "RESTAURANT" && i.status === "SENT").length,
  }

  return {
    success: true,
    dryRun,
    timestamp: new Date().toISOString(),
    stats: {
      scannedActiveSellers: candidates.length,
      processedCount: items.length,
      sentCount,
      failedCount,
      skippedAlreadySentToday,
      skippedCycleCompleted,
      skippedInactive,
      byType,
    },
    items,
  }
}
