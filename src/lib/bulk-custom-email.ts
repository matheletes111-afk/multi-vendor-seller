import { prisma } from "@/lib/prisma"
import { sendAdminCustomSellerEmail } from "@/lib/email"
import { sendNotificationSms } from "@/lib/twilio-sms"

export type BulkSellerTypeFilter = "ALL" | "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
export type BulkSellerStatusFilter = "ALL" | "ACTIVE" | "PENDING" | "SUSPENDED"

export interface BulkEmailRecipient {
  id: string
  sellerType: "PRODUCT" | "SERVICE" | "HOTEL" | "RESTAURANT"
  name: string | null
  businessName: string | null
  email: string | null
  phone: string | null
  phoneCountryCode: string | null
  channel: "email" | "sms" | "none"
  status: string
  isApproved: boolean
  onboardingCompleted: boolean
  isSuspended: boolean
}

export interface BulkCustomEmailFilterOptions {
  sellerType?: BulkSellerTypeFilter
  statusFilter?: BulkSellerStatusFilter
  sellerIds?: string[]
  search?: string
}

export interface BulkCustomEmailChunkOptions {
  recipients: BulkEmailRecipient[]
  subject: string
  message: string
  senderLabel?: string
  dryRun?: boolean
}

export interface BulkCustomEmailRecipientSummary {
  total: number
  byType: {
    product: number
    service: number
    hotel: number
    restaurant: number
  }
  byChannel: {
    email: number
    sms: number
    none: number
  }
  recipients: BulkEmailRecipient[]
}

/**
 * Build Prisma where clause based on status filter
 */
function buildStatusWhereClause(statusFilter: BulkSellerStatusFilter = "ALL") {
  switch (statusFilter) {
    case "ACTIVE":
      return {
        isSuspended: false,
        isApproved: true,
        onboardingCompleted: true,
      }
    case "PENDING":
      return {
        isSuspended: false,
        OR: [{ isApproved: false }, { onboardingCompleted: false }],
      }
    case "SUSPENDED":
      return {
        isSuspended: true,
      }
    case "ALL":
    default:
      return {}
  }
}

/**
 * Fetch all eligible recipients for a bulk custom message broadcast
 */
export async function getBulkCustomEmailRecipients(
  options: BulkCustomEmailFilterOptions = {}
): Promise<BulkCustomEmailRecipientSummary> {
  const {
    sellerType = "ALL",
    statusFilter = "ALL",
    sellerIds,
    search,
  } = options

  const normalizedType = sellerType.toUpperCase() as BulkSellerTypeFilter
  const statusWhere = buildStatusWhereClause(statusFilter)

  const queryProduct = normalizedType === "ALL" || normalizedType === "PRODUCT"
  const queryService = normalizedType === "ALL" || normalizedType === "SERVICE"
  const queryHotel = normalizedType === "ALL" || normalizedType === "HOTEL"
  const queryRestaurant = normalizedType === "ALL" || normalizedType === "RESTAURANT"

  const idWhere = sellerIds && sellerIds.length > 0 ? { id: { in: sellerIds } } : {}

  const [sellersRaw, hotelSellersRaw, restaurantSellersRaw] = await Promise.all([
    queryProduct || queryService
      ? prisma.seller.findMany({
          where: {
            ...statusWhere,
            ...idWhere,
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
        })
      : Promise.resolve([]),
    queryHotel
      ? prisma.hotelSeller.findMany({
          where: {
            ...statusWhere,
            ...idWhere,
          },
          include: {
            user: true,
            businessInfo: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    queryRestaurant
      ? prisma.restaurantSeller.findMany({
          where: {
            ...statusWhere,
            ...idWhere,
          },
          include: {
            user: true,
            businessInfo: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ])

  const recipients: BulkEmailRecipient[] = []
  const seenIds = new Set<string>()

  // Process standard Product / Service sellers
  for (const s of (sellersRaw as any[])) {
    if (seenIds.has(s.id)) continue
    seenIds.add(s.id)

    const email = s.user?.email?.trim().toLowerCase() || null
    const phone = s.user?.phone?.trim() || s.store?.phone?.trim() || null
    const phoneCountryCode = s.user?.phoneCountryCode?.trim() || null
    const channel: "email" | "sms" | "none" = email ? "email" : phone ? "sms" : "none"

    const displayName = s.user?.name || s.store?.name || s.businessInfo?.businessName || null
    const bizName = s.businessInfo?.businessName || s.store?.name || null

    recipients.push({
      id: s.id,
      sellerType: s.type === "SERVICE" ? "SERVICE" : "PRODUCT",
      name: displayName,
      businessName: bizName,
      email,
      phone,
      phoneCountryCode,
      channel,
      status: s.status,
      isApproved: s.isApproved,
      onboardingCompleted: s.onboardingCompleted,
      isSuspended: s.isSuspended,
    })
  }

  // Process Hotel sellers
  for (const h of (hotelSellersRaw as any[])) {
    if (seenIds.has(h.id)) continue
    seenIds.add(h.id)

    const email = h.user?.email?.trim().toLowerCase() || null
    const phone = h.user?.phone?.trim() || h.businessInfo?.pocContact?.trim() || null
    const phoneCountryCode = h.user?.phoneCountryCode?.trim() || null
    const channel: "email" | "sms" | "none" = email ? "email" : phone ? "sms" : "none"

    const displayName = h.user?.name || h.businessInfo?.businessName || null
    const bizName = h.businessInfo?.businessName || null

    recipients.push({
      id: h.id,
      sellerType: "HOTEL",
      name: displayName,
      businessName: bizName,
      email,
      phone,
      phoneCountryCode,
      channel,
      status: h.status,
      isApproved: h.isApproved,
      onboardingCompleted: h.onboardingCompleted,
      isSuspended: h.isSuspended,
    })
  }

  // Process Restaurant sellers
  for (const r of (restaurantSellersRaw as any[])) {
    if (seenIds.has(r.id)) continue
    seenIds.add(r.id)

    const email = r.user?.email?.trim().toLowerCase() || null
    const phone = r.user?.phone?.trim() || r.businessInfo?.pocContact?.trim() || null
    const phoneCountryCode = r.user?.phoneCountryCode?.trim() || null
    const channel: "email" | "sms" | "none" = email ? "email" : phone ? "sms" : "none"

    const displayName = r.user?.name || r.businessInfo?.businessName || null
    const bizName = r.businessInfo?.businessName || null

    recipients.push({
      id: r.id,
      sellerType: "RESTAURANT",
      name: displayName,
      businessName: bizName,
      email,
      phone,
      phoneCountryCode,
      channel,
      status: r.status,
      isApproved: r.isApproved,
      onboardingCompleted: r.onboardingCompleted,
      isSuspended: r.isSuspended,
    })
  }

  // Optional search filter across name, business name, email, or phone
  let filteredRecipients = recipients
  if (search && search.trim()) {
    const q = search.trim().toLowerCase()
    filteredRecipients = recipients.filter(
      (r) =>
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.phone && r.phone.toLowerCase().includes(q)) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.businessName && r.businessName.toLowerCase().includes(q))
    )
  }

  const byType = {
    product: filteredRecipients.filter((r) => r.sellerType === "PRODUCT").length,
    service: filteredRecipients.filter((r) => r.sellerType === "SERVICE").length,
    hotel: filteredRecipients.filter((r) => r.sellerType === "HOTEL").length,
    restaurant: filteredRecipients.filter((r) => r.sellerType === "RESTAURANT").length,
  }

  const byChannel = {
    email: filteredRecipients.filter((r) => r.channel === "email").length,
    sms: filteredRecipients.filter((r) => r.channel === "sms").length,
    none: filteredRecipients.filter((r) => r.channel === "none").length,
  }

  return {
    total: filteredRecipients.length,
    byType,
    byChannel,
    recipients: filteredRecipients,
  }
}

/**
 * Dispatches custom message (Email with SMS fallback) to a batch of recipients
 */
export async function sendBulkCustomEmailChunk(
  options: BulkCustomEmailChunkOptions
): Promise<{
  processed: number
  sent: number
  failed: number
  results: Array<{
    id: string
    email: string | null
    phone?: string | null
    channel: "email" | "sms" | "none"
    sellerName: string | null
    sellerType: string
    status: "success" | "failed"
    error?: string
  }>
}> {
  const {
    recipients,
    subject,
    message,
    senderLabel = "MEEEM Partner Operations",
    dryRun = false,
  } = options

  const results: Array<{
    id: string
    email: string | null
    phone?: string | null
    channel: "email" | "sms" | "none"
    sellerName: string | null
    sellerType: string
    status: "success" | "failed"
    error?: string
  }> = []

  let sent = 0
  let failed = 0

  for (const recipient of recipients) {
    const sellerDisplayName =
      recipient.name || recipient.businessName || "Valued MEEEM Partner"

    if (dryRun) {
      results.push({
        id: recipient.id,
        email: recipient.email,
        phone: recipient.phone,
        channel: recipient.channel,
        sellerName: sellerDisplayName,
        sellerType: recipient.sellerType,
        status: "success",
      })
      sent++
      continue
    }

    if (recipient.channel === "none") {
      failed++
      results.push({
        id: recipient.id,
        email: recipient.email,
        phone: recipient.phone,
        channel: "none",
        sellerName: sellerDisplayName,
        sellerType: recipient.sellerType,
        status: "failed",
        error: "Seller has no email or phone number on record",
      })
      continue
    }

    try {
      if (recipient.channel === "email" && recipient.email) {
        const emailResult = await sendAdminCustomSellerEmail({
          to: recipient.email,
          sellerName: sellerDisplayName,
          businessName: recipient.businessName || undefined,
          subject,
          message,
          adminName: senderLabel,
          toPhone: recipient.phone,
          phoneCountryCode: recipient.phoneCountryCode,
        })

        if (emailResult.success) {
          sent++
          results.push({
            id: recipient.id,
            email: recipient.email,
            phone: recipient.phone,
            channel: "email",
            sellerName: sellerDisplayName,
            sellerType: recipient.sellerType,
            status: "success",
          })
        } else {
          failed++
          results.push({
            id: recipient.id,
            email: recipient.email,
            phone: recipient.phone,
            channel: "email",
            sellerName: sellerDisplayName,
            sellerType: recipient.sellerType,
            status: "failed",
            error: ("error" in emailResult && (emailResult.error as any)?.message) || "SendGrid dispatch failed",
          })
        }
      } else if (recipient.phone) {
        // SMS Fallback
        const preview = message.length > 280 ? `${message.slice(0, 277)}...` : message
        const headline = subject && subject.trim() ? `${subject.trim()} - ` : ""
        const smsBody = `Hi ${sellerDisplayName}, MEEEM Notice: ${headline}${preview}`
        const smsSent = await sendNotificationSms({
          to: recipient.phone,
          countryCode: recipient.phoneCountryCode,
          body: smsBody,
        })

        if (smsSent) {
          sent++
          results.push({
            id: recipient.id,
            email: recipient.email,
            phone: recipient.phone,
            channel: "sms",
            sellerName: sellerDisplayName,
            sellerType: recipient.sellerType,
            status: "success",
          })
        } else {
          failed++
          results.push({
            id: recipient.id,
            email: recipient.email,
            phone: recipient.phone,
            channel: "sms",
            sellerName: sellerDisplayName,
            sellerType: recipient.sellerType,
            status: "failed",
            error: "Twilio SMS dispatch failed",
          })
        }
      }
    } catch (err: any) {
      failed++
      results.push({
        id: recipient.id,
        email: recipient.email,
        phone: recipient.phone,
        channel: recipient.channel,
        sellerName: sellerDisplayName,
        sellerType: recipient.sellerType,
        status: "failed",
        error: err?.message || "Unexpected dispatch error",
      })
    }
  }

  return {
    processed: recipients.length,
    sent,
    failed,
    results,
  }
}
