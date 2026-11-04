import { prisma } from "@/lib/prisma"
import { PlanType } from "@prisma/client"
import { promoteQueuedPackIfExists } from "@/lib/subscriptions"
import { sendEmail } from "@/lib/email"
import { sendSmsViaTwilio, normalizePhoneNumber } from "@/lib/twilio-sms"
import { sendPushNotification } from "@/lib/firebase-messaging"
import { formatCurrency } from "@/lib/utils"

export interface SweepOptions {
  dryRun?: boolean
  force?: boolean
  now?: Date
}

export interface SweepResult {
  success: boolean
  dryRun: boolean
  timestamp: string
  sweptAt: Date
  stalePendingFailedCount: number
  expiredCount: number
  promotedCount: number
  remindersSent: {
    email: number
    sms: number
    push: number
  }
  errors: string[]
  details: Array<{
    sellerType: string
    sellerId: string
    storeName?: string
    email?: string
    phone?: string
    action: "EXPIRED" | "PROMOTED_QUEUED" | "REMINDER_SENT" | "SKIPPED"
    daysLeft?: number
    planName?: string
    notes?: string
  }>
}

/**
 * Universal Lifecycle Sweep Engine for all 4 Seller Types:
 * 1. Checks overdue subscriptions and promotes queued pack if present, or marks EXPIRED.
 * 2. Sweeps upcoming expirations (7..1 days and 0) and delivers multi-channel reminders.
 * 3. 100% Idempotent via SubscriptionReminderLog.
 */
export async function runSubscriptionLifecycleSweep(options: SweepOptions = {}): Promise<SweepResult> {
  const { dryRun = false, now = new Date() } = options

  const result: SweepResult = {
    success: true,
    dryRun,
    timestamp: now.toISOString(),
    sweptAt: now,
    stalePendingFailedCount: 0,
    expiredCount: 0,
    promotedCount: 0,
    remindersSent: {
      email: 0,
      sms: 0,
      push: 0,
    },
    errors: [],
    details: [],
  }

  try {
    // =========================================================================
    // 0. AUTO-FAIL STALE PENDING PAYMENTS (>15 mins old)
    // =========================================================================
    if (!dryRun) {
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)
      const stalePending = await prisma.subscriptionPurchase.updateMany({
        where: {
          status: "PENDING_PAYMENT",
          createdAt: { lte: fifteenMinutesAgo },
        },
        data: {
          status: "FAILED",
          note: "Payment request timed out after 15 minutes of inactivity",
        },
      })
      result.stalePendingFailedCount = stalePending.count
    }

    // =========================================================================
    // 1. PROCESS OVERDUE SUBSCRIPTIONS (Expiry & Queued Promotion)
    // =========================================================================

    // 1A. Product & Service Sellers
    const overdueProductSubs = await prisma.subscription.findMany({
      where: {
        status: { in: ["ACTIVE", "TRIALING", "IN_GRACE_PERIOD"] },
        currentPeriodEnd: { lte: now },
        provider: { not: "apple_iap" },
      },
      include: {
        seller: {
          include: {
            user: { select: { id: true, email: true, phone: true, name: true, deviceTokens: true } },
            store: { select: { name: true } },
          },
        },
        plan: true,
      },
    })

    for (const sub of overdueProductSubs) {
      const sellerId = sub.sellerId
      const storeName = sub.seller.store?.name || sub.seller.user.name || "Seller Store"

      if (dryRun) {
        result.expiredCount++
        result.details.push({
          sellerType: "PRODUCT_SERVICE",
          sellerId,
          storeName,
          action: "EXPIRED",
          notes: "[DRY-RUN] Overdue subscription would expire or promote queued pack",
        })
        continue
      }

      // Check if seller has a queued pack
      const promoted = await promoteQueuedPackIfExists(PlanType.PRODUCT_SERVICE, sellerId)
      if (promoted) {
        result.promotedCount++
        result.details.push({
          sellerType: "PRODUCT_SERVICE",
          sellerId,
          storeName,
          action: "PROMOTED_QUEUED",
          notes: `Promoted queued pack: ${promoted.plan?.displayName || "Plan"} until ${promoted.currentPeriodEnd}`,
        })
      } else {
        // No queued pack -> mark EXPIRED in cache & purchases
        await prisma.subscription.update({
          where: { sellerId },
          data: { status: "EXPIRED" },
        })

        await prisma.subscriptionPurchase.updateMany({
          where: {
            sellerType: PlanType.PRODUCT_SERVICE,
            sellerId,
            status: "ACTIVE",
          },
          data: { status: "EXPIRED", expiredAt: now },
        })

        result.expiredCount++
        result.details.push({
          sellerType: "PRODUCT_SERVICE",
          sellerId,
          storeName,
          action: "EXPIRED",
          notes: "Pack expired; store listings are now hidden by visibility gate",
        })

        // One-time expired notification
        await sendExpiredNotice({
          sellerType: PlanType.PRODUCT_SERVICE,
          sellerId,
          storeName,
          user: sub.seller.user,
          planName: sub.plan.displayName || sub.plan.name,
          dryRun,
          result,
        })
      }
    }

    // 1B. Hotel Sellers
    const overdueHotelSubs = await prisma.hotelSubscription.findMany({
      where: {
        status: { in: ["ACTIVE", "TRIALING", "IN_GRACE_PERIOD"] },
        currentPeriodEnd: { lte: now },
        provider: { not: "apple_iap" },
      },
      include: {
        hotelSeller: {
          include: {
            user: { select: { id: true, email: true, phone: true, name: true, deviceTokens: true } },
            businessInfo: { select: { businessName: true } },
          },
        },
        plan: true,
      },
    })

    for (const sub of overdueHotelSubs) {
      const sellerId = sub.hotelSellerId
      const storeName = sub.hotelSeller.businessInfo?.businessName || sub.hotelSeller.user.name || "Hotel Seller"

      if (dryRun) {
        result.expiredCount++
        result.details.push({
          sellerType: "HOTEL",
          sellerId,
          storeName,
          action: "EXPIRED",
          notes: "[DRY-RUN] Overdue hotel subscription would expire or promote queued pack",
        })
        continue
      }

      const promoted = await promoteQueuedPackIfExists(PlanType.HOTEL, sellerId)
      if (promoted) {
        result.promotedCount++
        result.details.push({
          sellerType: "HOTEL",
          sellerId,
          storeName,
          action: "PROMOTED_QUEUED",
          notes: `Promoted queued hotel pack until ${promoted.currentPeriodEnd}`,
        })
      } else {
        await prisma.hotelSubscription.update({
          where: { hotelSellerId: sellerId },
          data: { status: "EXPIRED" },
        })

        await prisma.subscriptionPurchase.updateMany({
          where: {
            sellerType: PlanType.HOTEL,
            hotelSellerId: sellerId,
            status: "ACTIVE",
          },
          data: { status: "EXPIRED", expiredAt: now },
        })

        result.expiredCount++
        result.details.push({
          sellerType: "HOTEL",
          sellerId,
          storeName,
          action: "EXPIRED",
          notes: "Hotel pack expired; rooms hidden from marketplace",
        })

        // One-time expired notification
        await sendExpiredNotice({
          sellerType: PlanType.HOTEL,
          sellerId,
          storeName,
          user: sub.hotelSeller.user,
          planName: sub.plan.displayName || sub.plan.name,
          dryRun,
          result,
        })
      }
    }

    // 1C. Restaurant Sellers
    const overdueRestSubs = await prisma.restaurantSubscription.findMany({
      where: {
        status: { in: ["ACTIVE", "TRIALING", "IN_GRACE_PERIOD"] },
        currentPeriodEnd: { lte: now },
        provider: { not: "apple_iap" },
      },
      include: {
        restaurantSeller: {
          include: {
            user: { select: { id: true, email: true, phone: true, name: true, deviceTokens: true } },
            businessInfo: { select: { businessName: true } },
          },
        },
        plan: true,
      },
    })

    for (const sub of overdueRestSubs) {
      const sellerId = sub.restaurantSellerId
      const storeName = sub.restaurantSeller.businessInfo?.businessName || sub.restaurantSeller.user.name || "Restaurant Seller"

      if (dryRun) {
        result.expiredCount++
        result.details.push({
          sellerType: "RESTAURANT",
          sellerId,
          storeName,
          action: "EXPIRED",
          notes: "[DRY-RUN] Overdue restaurant subscription would expire or promote queued pack",
        })
        continue
      }

      const promoted = await promoteQueuedPackIfExists(PlanType.RESTAURANT, sellerId)
      if (promoted) {
        result.promotedCount++
        result.details.push({
          sellerType: "RESTAURANT",
          sellerId,
          storeName,
          action: "PROMOTED_QUEUED",
          notes: `Promoted queued restaurant pack until ${promoted.currentPeriodEnd}`,
        })
      } else {
        await prisma.restaurantSubscription.update({
          where: { restaurantSellerId: sellerId },
          data: { status: "EXPIRED" },
        })

        await prisma.subscriptionPurchase.updateMany({
          where: {
            sellerType: PlanType.RESTAURANT,
            restaurantSellerId: sellerId,
            status: "ACTIVE",
          },
          data: { status: "EXPIRED", expiredAt: now },
        })

        result.expiredCount++
        result.details.push({
          sellerType: "RESTAURANT",
          sellerId,
          storeName,
          action: "EXPIRED",
          notes: "Restaurant pack expired; menu items hidden from marketplace",
        })

        // One-time expired notification
        await sendExpiredNotice({
          sellerType: PlanType.RESTAURANT,
          sellerId,
          storeName,
          user: sub.restaurantSeller.user,
          planName: sub.plan.displayName || sub.plan.name,
          dryRun,
          result,
        })
      }
    }

    // =========================================================================
    // 2. MULTI-CHANNEL EXPIRY REMINDERS (7, 6, 5, 4, 3, 2, 1 Days and 0 Today)
    // =========================================================================

    const eightDaysFromNow = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000)

    // Load active purchases expiring in the next 8 days
    const expiringPurchases = await prisma.subscriptionPurchase.findMany({
      where: {
        status: "ACTIVE",
        periodEnd: {
          gt: now,
          lte: eightDaysFromNow,
        },
      },
      include: {
        plan: true,
        seller: {
          include: {
            user: { select: { id: true, email: true, phone: true, name: true, deviceTokens: true } },
            store: { select: { name: true } },
          },
        },
        hotelSeller: {
          include: {
            user: { select: { id: true, email: true, phone: true, name: true, deviceTokens: true } },
          },
        },
        restaurantSeller: {
          include: {
            user: { select: { id: true, email: true, phone: true, name: true, deviceTokens: true } },
          },
        },
        reminderLogs: true,
      },
    })

    for (const purchase of expiringPurchases) {
      if (!purchase.periodEnd) continue

      const msLeft = purchase.periodEnd.getTime() - now.getTime()
      const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)))

      if (daysLeft < 0 || daysLeft > 7) continue

      // Resolve seller user info
      let user: any = null
      let storeName = "Seller Store"

      if (purchase.sellerType === PlanType.PRODUCT_SERVICE && purchase.seller) {
        user = purchase.seller.user
        storeName = purchase.seller.store?.name || user.name || "Store"
      } else if (purchase.sellerType === PlanType.HOTEL && purchase.hotelSeller) {
        user = purchase.hotelSeller.user
        storeName = (purchase.hotelSeller as any).businessInfo?.businessName || user.name || "Hotel"
      } else if (purchase.sellerType === PlanType.RESTAURANT && purchase.restaurantSeller) {
        user = purchase.restaurantSeller.user
        storeName = (purchase.restaurantSeller as any).businessInfo?.businessName || user.name || "Restaurant"
      }

      if (!user) continue

      // Section 9.3: Skip reminders if seller already has a QUEUED pack
      const sellerId = purchase.sellerId || purchase.hotelSellerId || purchase.restaurantSellerId
      const queuedPack = await prisma.subscriptionPurchase.findFirst({
        where: {
          sellerType: purchase.sellerType,
          ...(purchase.sellerType === PlanType.PRODUCT_SERVICE ? { sellerId: purchase.sellerId! } : {}),
          ...(purchase.sellerType === PlanType.HOTEL ? { hotelSellerId: purchase.hotelSellerId! } : {}),
          ...(purchase.sellerType === PlanType.RESTAURANT ? { restaurantSellerId: purchase.restaurantSellerId! } : {}),
          status: "QUEUED",
        },
      })

      if (queuedPack) {
        result.details.push({
          sellerType: purchase.sellerType,
          sellerId: sellerId!,
          storeName,
          action: "SKIPPED",
          daysLeft,
          planName: purchase.plan?.displayName || "Plan",
          notes: "Skipped reminders because seller already has a QUEUED pack scheduled",
        })
        continue
      }

      const planName = purchase.plan?.displayName || purchase.plan?.name || "Subscription Pack"
      const expiryFormatted = purchase.periodEnd.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })

      const existingReminders = purchase.reminderLogs.filter((log) => log.daysLeft === daysLeft)
      const hasEmailLog = existingReminders.some((l) => l.channel === "EMAIL")
      const hasSmsLog = existingReminders.some((l) => l.channel === "SMS")
      const hasPushLog = existingReminders.some((l) => l.channel === "PUSH")

      // --- CHANNEL 1: EMAIL (SendGrid) ---
      if (user.email && !hasEmailLog) {
        if (!dryRun) {
          try {
            const subject = daysLeft === 0
              ? `[ACTION REQUIRED] Your ${planName} expires today! (${storeName})`
              : `Reminder: Your ${planName} expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"} (${storeName})`

            const html = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #0f172a; margin-top: 0;">Subscription Recharge Reminder</h2>
                <p>Hello <strong>${storeName}</strong>,</p>
                <p>This is a friendly reminder that your subscription pack (<strong>${planName}</strong>) expires on <strong>${expiryFormatted}</strong> (${daysLeft === 0 ? "today" : `in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`}).</p>
                <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; color: #334155;">
                    To keep your items visible to customers across our Web and Mobile marketplace, please recharge your subscription before expiry.
                  </p>
                </div>
                <div style="margin: 25px 0;">
                  <a href="https://www.meeemsl.com" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                    Recharge via AfriMoney
                  </a>
                </div>
                <p style="font-size: 12px; color: #64748b; margin-top: 30px;">
                  Thank you for partnering with MEEEM. If you have already recharged, your new pack is queued and will activate automatically.
                </p>
              </div>
            `

            await sendEmail({
              to: user.email,
              subject,
              html,
            })

            await prisma.subscriptionReminderLog.create({
              data: {
                purchaseId: purchase.id,
                daysLeft,
                channel: "EMAIL",
                status: "SENT",
              },
            })

            result.remindersSent.email++
          } catch (err: any) {
            console.error(`[Lifecycle Sweep] Email reminder error for ${user.email}:`, err)
            await prisma.subscriptionReminderLog.create({
              data: {
                purchaseId: purchase.id,
                daysLeft,
                channel: "EMAIL",
                status: "FAILED",
                error: err?.message || "SendGrid error",
              },
            }).catch(() => {})
          }
        } else {
          result.remindersSent.email++
        }
      }

      // --- CHANNEL 2: SMS (Twilio) ---
      if (user.phone && !hasSmsLog) {
        if (!dryRun) {
          try {
            const normalizedPhone = normalizePhoneNumber(user.phone)
            const smsText = daysLeft === 0
              ? `MEEEM: Your ${planName} expires today (${expiryFormatted}). Please recharge to keep your store items visible to buyers. Log in to recharge via AfriMoney.`
              : `MEEEM: Your ${planName} expires in ${daysLeft} days (${expiryFormatted}). Recharge now via AfriMoney on your dashboard to avoid marketplace downtime.`

            await sendSmsViaTwilio({
              to: normalizedPhone,
              body: smsText,
            })

            await prisma.subscriptionReminderLog.create({
              data: {
                purchaseId: purchase.id,
                daysLeft,
                channel: "SMS",
                status: "SENT",
              },
            })

            result.remindersSent.sms++
          } catch (err: any) {
            console.error(`[Lifecycle Sweep] SMS reminder error for ${user.phone}:`, err)
            await prisma.subscriptionReminderLog.create({
              data: {
                purchaseId: purchase.id,
                daysLeft,
                channel: "SMS",
                status: "FAILED",
                error: err?.message || "Twilio error",
              },
            }).catch(() => {})
          }
        } else {
          result.remindersSent.sms++
        }
      }

      // --- CHANNEL 3: PUSH NOTIFICATION (Firebase FCM) ---
      const deviceTokens = Array.isArray(user.deviceTokens)
        ? user.deviceTokens.map((t: any) => t.token || t).filter(Boolean)
        : []

      if (deviceTokens.length > 0 && !hasPushLog) {
        if (!dryRun) {
          try {
            const pushTitle = daysLeft === 0 ? "Subscription Expires Today" : `Subscription Expiring in ${daysLeft} Days`
            const pushBody = `Your ${planName} expires on ${expiryFormatted}. Tap to recharge via AfriMoney.`

            await sendPushNotification({
              tokens: deviceTokens,
              title: pushTitle,
              body: pushBody,
              data: {
                type: "SUBSCRIPTION_REMINDER",
                daysLeft: String(daysLeft),
                purchaseId: purchase.id,
              },
              userId: user.id,
            })

            await prisma.subscriptionReminderLog.create({
              data: {
                purchaseId: purchase.id,
                daysLeft,
                channel: "PUSH",
                status: "SENT",
              },
            })

            result.remindersSent.push++
          } catch (err: any) {
            console.error(`[Lifecycle Sweep] FCM push error for user ${user.id}:`, err)
            await prisma.subscriptionReminderLog.create({
              data: {
                purchaseId: purchase.id,
                daysLeft,
                channel: "PUSH",
                status: "FAILED",
                error: err?.message || "Firebase error",
              },
            }).catch(() => {})
          }
        } else {
          result.remindersSent.push++
        }
      }

      result.details.push({
        sellerType: purchase.sellerType,
        sellerId: (purchase.sellerId || purchase.hotelSellerId || purchase.restaurantSellerId)!,
        storeName,
        email: user.email,
        phone: user.phone,
        action: "REMINDER_SENT",
        daysLeft,
        planName,
        notes: `Milestone ${daysLeft} days before expiry`,
      })
    }
  } catch (error: any) {
    console.error("[runSubscriptionLifecycleSweep] Critical error:", error)
    result.success = false
    result.errors.push(error?.message || "Unknown sweep error")
  }

  return result
}

/**
 * Sends a one-time "Plan Expired" alert on all 3 channels when a subscription finishes its validity
 * with no queued pack to promote. Uses daysLeft = -1 in SubscriptionReminderLog for idempotency.
 */
async function sendExpiredNotice({
  sellerType,
  sellerId,
  storeName,
  user,
  planName,
  dryRun,
  result,
}: {
  sellerType: PlanType
  sellerId: string
  storeName: string
  user: { id: string; email: string | null; phone: string | null; deviceTokens?: any } | null
  planName: string
  dryRun: boolean
  result: SweepResult
}) {
  if (!user || dryRun) return

  // Find the last purchase record to associate the reminder log
  const lastPurchase = await prisma.subscriptionPurchase.findFirst({
    where: {
      sellerType,
      ...(sellerType === PlanType.PRODUCT_SERVICE ? { sellerId } : {}),
      ...(sellerType === PlanType.HOTEL ? { hotelSellerId: sellerId } : {}),
      ...(sellerType === PlanType.RESTAURANT ? { restaurantSellerId: sellerId } : {}),
    },
    orderBy: { periodEnd: "desc" },
  })

  if (!lastPurchase) return

  const pId = lastPurchase.id

  const existingLogs = await prisma.subscriptionReminderLog.findMany({
    where: {
      purchaseId: pId,
      daysLeft: -1,
    },
  })

  const hasEmail = existingLogs.some((l) => l.channel === "EMAIL")
  const hasSms = existingLogs.some((l) => l.channel === "SMS")
  const hasPush = existingLogs.some((l) => l.channel === "PUSH")

  // EMAIL
  if (user.email && !hasEmail) {
    try {
      await sendEmail({
        to: user.email,
        subject: `[ACTION REQUIRED] Your ${planName} has expired - items hidden (${storeName})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fecaca; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #dc2626; margin-top: 0;">Subscription Plan Expired</h2>
            <p>Hello <strong>${storeName}</strong>,</p>
            <p>Your subscription pack (<strong>${planName}</strong>) has expired. As a result, your store listings and products are now <strong>hidden from customer view</strong> across the MEEEM marketplace.</p>
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #991b1b;">
                Recharge now via AfriMoney on your seller dashboard to instantly restore your store and make all items visible to buyers again.
              </p>
            </div>
            <div style="margin: 25px 0;">
              <a href="https://www.meeemsl.com" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                Recharge via AfriMoney
              </a>
            </div>
          </div>
        `,
      })
      await prisma.subscriptionReminderLog.create({
        data: { purchaseId: pId, daysLeft: -1, channel: "EMAIL", status: "SENT" },
      })
      result.remindersSent.email++
    } catch (err: any) {
      console.error(`[Lifecycle Sweep] Expired email notification error for ${user.email}:`, err)
      await prisma.subscriptionReminderLog.create({
        data: { purchaseId: pId, daysLeft: -1, channel: "EMAIL", status: "FAILED", error: err?.message },
      }).catch(() => {})
    }
  }

  // SMS
  if (user.phone && !hasSms) {
    try {
      const normalizedPhone = normalizePhoneNumber(user.phone)
      await sendSmsViaTwilio({
        to: normalizedPhone,
        body: `MEEEM: Your ${planName} has expired. Your store items are now hidden from buyers. Log in and recharge via AfriMoney to restore your marketplace visibility.`,
      })
      await prisma.subscriptionReminderLog.create({
        data: { purchaseId: pId, daysLeft: -1, channel: "SMS", status: "SENT" },
      })
      result.remindersSent.sms++
    } catch (err: any) {
      console.error(`[Lifecycle Sweep] Expired SMS notification error for ${user.phone}:`, err)
      await prisma.subscriptionReminderLog.create({
        data: { purchaseId: pId, daysLeft: -1, channel: "SMS", status: "FAILED", error: err?.message },
      }).catch(() => {})
    }
  }

  // PUSH
  const deviceTokens = Array.isArray(user.deviceTokens)
    ? user.deviceTokens.map((t: any) => t.token || t).filter(Boolean)
    : []

  if (deviceTokens.length > 0 && !hasPush) {
    try {
      await sendPushNotification({
        tokens: deviceTokens,
        title: "Subscription Expired",
        body: `Your ${planName} expired. Store items are now hidden until recharge. Tap to recharge via AfriMoney.`,
        data: {
          type: "SUBSCRIPTION_EXPIRED",
          purchaseId: pId,
        },
        userId: user.id,
      })
      await prisma.subscriptionReminderLog.create({
        data: { purchaseId: pId, daysLeft: -1, channel: "PUSH", status: "SENT" },
      })
      result.remindersSent.push++
    } catch (err: any) {
      console.error(`[Lifecycle Sweep] Expired FCM push error for user ${user.id}:`, err)
      await prisma.subscriptionReminderLog.create({
        data: { purchaseId: pId, daysLeft: -1, channel: "PUSH", status: "FAILED", error: err?.message },
      }).catch(() => {})
    }
  }
}
