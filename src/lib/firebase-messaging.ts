import { getFirebaseMessaging } from "./firebase-admin"
import { prisma } from "./prisma"

export interface SendPushNotificationParams {
  tokens: string[]
  title: string
  body: string
  data?: Record<string, string>
  riderId?: string // If provided, invalid tokens will be cleaned from DB
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
        ...data,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "delivery_alerts",
          priority: "max",
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
  rider: { id: string; deviceTokens: any },
  payload: {
    orderId: string
    orderNumber: string
    assignmentId: string
    shopName: string
    shopDistanceKm?: number
    customerZone?: string
    timeoutSeconds: number
  }
) {
  const tokens = extractTokens(rider.deviceTokens)
  if (tokens.length === 0) {
    console.log(`[FCM] Rider ${rider.id} has no registered device tokens.`)
    return
  }

  const distText = payload.shopDistanceKm ? ` (${payload.shopDistanceKm} km away)` : ""

  return sendPushNotification({
    tokens,
    riderId: rider.id,
    title: "📦 New Delivery Assignment Offer!",
    body: `Pickup from ${payload.shopName}${distText}. Tap to accept within ${payload.timeoutSeconds}s!`,
    data: {
      type: "NEW_OFFER",
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      assignmentId: payload.assignmentId,
      timeout: String(payload.timeoutSeconds),
    },
  })
}

function extractTokens(deviceTokensField: any): string[] {
  if (!deviceTokensField) return []
  if (Array.isArray(deviceTokensField)) {
    return deviceTokensField
      .map((item) => (typeof item === "string" ? item : item?.token))
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
  }
  if (typeof deviceTokensField === "string") {
    return [deviceTokensField]
  }
  return []
}
