import { getFirebaseMessaging } from "./firebase-admin"
import { prisma } from "./prisma"

export interface SendPushNotificationParams {
  tokens: string[]
  title: string
  body: string
  data?: Record<string, string>
  riderId?: string // If provided, invalid tokens will be cleaned from Rider DB
  userId?: string // If provided, invalid tokens will be cleaned from User DB (Customer/Seller)
}

export interface PushResult {
  successCount: number
  failureCount: number
  errors: string[]
}

/**
 * Sends FCM push notification to one or multiple device tokens.
 */
export async function sendPushNotification({
  tokens,
  title,
  body,
  data = {},
  riderId,
  userId,
}: SendPushNotificationParams): Promise<PushResult> {
  const cleanTokens = Array.from(
    new Set(tokens.filter((t) => typeof t === "string" && t.trim().length > 0))
  )

  if (cleanTokens.length === 0) {
    return { successCount: 0, failureCount: 0, errors: ["No valid device tokens provided"] }
  }

  const messaging = getFirebaseMessaging()
  if (!messaging) {
    console.warn("[FCM] Firebase Messaging is not initialized or credentials missing.")
    return {
      successCount: 0,
      failureCount: cleanTokens.length,
      errors: ["Firebase Messaging not initialized"],
    }
  }

  try {
    const response = await messaging.sendEachForMulticast({
      tokens: cleanTokens,
      notification: {
        title,
        body,
      },
      data: {
        title,
        body,
        ...data,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "delivery_alerts",
          priority: "max",
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: "public",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    })

    const invalidTokens: string[] = []

    response.responses.forEach((res, index) => {
      if (!res.success && res.error) {
        const errorCode = res.error.code
        if (
          errorCode === "messaging/invalid-registration-token" ||
          errorCode === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(cleanTokens[index])
        }
      }
    })

    // Clean invalid tokens from DB if riderId is provided
    if (invalidTokens.length > 0 && riderId) {
      try {
        const rider = await prisma.rider.findUnique({
          where: { id: riderId },
          select: { deviceTokens: true },
        })

        if (rider && Array.isArray(rider.deviceTokens)) {
          const updatedTokens = (rider.deviceTokens as any[]).filter(
            (item) => !invalidTokens.includes(item.token)
          )
          await prisma.rider.update({
            where: { id: riderId },
            data: { deviceTokens: updatedTokens },
          })
        }
      } catch (err) {
        console.error("[FCM] Failed to clean invalid tokens for rider:", err)
      }
    }

    // Clean invalid tokens from DB if userId is provided (Customer / Seller)
    if (invalidTokens.length > 0 && userId) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { deviceTokens: true },
        })

        if (dbUser && Array.isArray(dbUser.deviceTokens)) {
          const updatedTokens = (dbUser.deviceTokens as any[]).filter(
            (item) => !invalidTokens.includes(item.token)
          )
          await prisma.user.update({
            where: { id: userId },
            data: { deviceTokens: updatedTokens },
          })
        }
      } catch (err) {
        console.error("[FCM] Failed to clean invalid tokens for user:", err)
      }
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      errors: response.responses
        .filter((r) => !r.success)
        .map((r) => r.error?.message || "Unknown error"),
    }
  } catch (error: any) {
    console.error("[FCM] Multicast send exception:", error?.message || error)
    return {
      successCount: 0,
      failureCount: cleanTokens.length,
      errors: [error?.message || "Failed to send multicast message"],
    }
  }
}

/**
 * Sends delivery assignment offer notification to a rider.
 */
export async function sendDeliveryOfferToRider(
  rider: { id: string; deviceTokens: any; onboardingCompleted?: boolean },
  payload: {
    orderId: string
    orderNumber: string
    assignmentId: string
    shopName: string
    shopAddress?: string
    shopDistanceKm?: number
    customerName?: string
    customerAddress?: string
    customerPhone?: string
    customerZone?: string
    deliveryFee?: number | string
    timeoutSeconds: number
    cycle?: number
    riderAttempt?: number
  }
) {
  if (rider.onboardingCompleted === false) {
    console.log(`[FCM] Blocked: Rider ${rider.id} has not completed onboarding. Skipping delivery push offer.`)
    return
  }

  const tokens = extractTokens(rider.deviceTokens)
  if (tokens.length === 0) {
    console.log(`[FCM] Rider ${rider.id} has no registered device tokens.`)
    return
  }

  const feeFormatted = payload.deliveryFee != null ? Number(payload.deliveryFee).toFixed(2) : "0.00"
  const distText = payload.shopDistanceKm ? ` (${payload.shopDistanceKm} km away)` : ""
  const feeText = Number(feeFormatted) > 0 ? ` • Earning: NLe ${feeFormatted}` : ""

  return sendPushNotification({
    tokens,
    riderId: rider.id,
    title: "📦 New Delivery Assignment Offer!",
    body: `Pickup from ${payload.shopName}${distText}${feeText}. Tap to accept within ${payload.timeoutSeconds}s!`,
    data: {
      type: "NEW_OFFER",
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      assignmentId: payload.assignmentId,
      timeout: String(payload.timeoutSeconds),
      deliveryFee: feeFormatted,
      deliveryEarning: feeFormatted,
      earning: feeFormatted,
      amount: feeFormatted,
      cycle: String(payload.cycle || 1),
      riderAttempt: String(payload.riderAttempt || 1),
      shopName: payload.shopName,
      shopAddress: payload.shopAddress || "",
      customerName: payload.customerName || "",
      customerAddress: payload.customerAddress || "",
      customerPhone: payload.customerPhone || "",
      distanceKm: payload.shopDistanceKm != null ? String(payload.shopDistanceKm) : "",
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    },
  })
}

export function extractTokens(deviceTokensField: any): string[] {
  if (!deviceTokensField) return []
  if (Array.isArray(deviceTokensField)) {
    return deviceTokensField
      .map((item) => (typeof item === "string" ? item : item?.token))
      .filter((t): t is string => typeof t === "string" && t.trim().length > 20 && !t.startsWith("dev_"))
  }
  if (typeof deviceTokensField === "string") {
    return deviceTokensField.trim().length > 20 && !deviceTokensField.startsWith("dev_")
      ? [deviceTokensField.trim()]
      : []
  }
  return []
}

/**
 * Sends FCM push notification to any registered User (Customer or Seller).
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: {
    title: string
    body: string
    data?: Record<string, string>
  }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deviceTokens: true },
  })

  if (!user) {
    console.warn(`[FCM] User ${userId} not found when attempting to send push notification.`)
    return { successCount: 0, failureCount: 0, errors: ["User not found"] }
  }

  const tokens = extractTokens(user.deviceTokens)
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, errors: ["No registered device tokens for user"] }
  }

  return sendPushNotification({
    tokens,
    userId: user.id,
    title: payload.title,
    body: payload.body,
    data: payload.data,
  })
}

/**
 * Sends push notification to a Customer by their User ID.
 */
export async function sendPushNotificationToCustomer(
  customerUserId: string,
  payload: {
    title: string
    body: string
    data?: Record<string, string>
  }
) {
  return sendPushNotificationToUser(customerUserId, payload)
}

/**
 * Sends push notification to a Seller by their User ID.
 */
export async function sendPushNotificationToSeller(
  sellerUserId: string,
  payload: {
    title: string
    body: string
    data?: Record<string, string>
  }
) {
  return sendPushNotificationToUser(sellerUserId, payload)
}

