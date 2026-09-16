import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { SubscriptionStatus } from "@prisma/client"
import {
  verifyStoreKit2Transaction,
  verifyAndDecodeNotification,
} from "./apple-iap"
import {
  getUnifiedMobileSellerAuth,
  getCurrentSellerSubscription,
  activateAppleIapSubscription,
} from "./unified-seller-subscription"

/**
 * Handler for GET /mobileapi/seller/iap/products
 */
export async function handleGetProducts(request: NextRequest) {
  try {
    const authResult = await getUnifiedMobileSellerAuth(request)
    if (authResult.ok === false) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const [plans, currentSubscription] = await Promise.all([
      prisma.plan.findMany({
        where: { type: authResult.sellerType },
        orderBy: { price: "asc" },
      }),
      getCurrentSellerSubscription(authResult),
    ])

    const products = plans.map((plan) => ({
      planId: plan.id,
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description,
      price: plan.price,
      durationDays: plan.duration,
      appleProductId: plan.appleProductId,
      maxProducts: plan.maxProducts,
      maxOrders: plan.maxOrders,
      maxRooms: plan.maxRooms,
      features: plan.features,
    }))

    return NextResponse.json({
      success: true,
      sellerType: authResult.sellerType,
      products,
      currentSubscription: currentSubscription
        ? {
            id: currentSubscription.id,
            planId: currentSubscription.planId,
            status: currentSubscription.status,
            provider: currentSubscription.provider,
            appleProductId: currentSubscription.appleProductId,
            currentPeriodStart: currentSubscription.currentPeriodStart,
            currentPeriodEnd: currentSubscription.currentPeriodEnd,
            plan: currentSubscription.plan,
          }
        : null,
    })
  } catch (error: any) {
    console.error("[AppleIAP] Error fetching products:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load products" },
      { status: 500 }
    )
  }
}

/**
 * Handler for POST /mobileapi/seller/iap/verify-purchase
 */
export async function handleVerifyPurchase(request: NextRequest) {
  try {
    const authResult = await getUnifiedMobileSellerAuth(request)
    if (authResult.ok === false) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { planId, jwsRepresentation } = body

    if (!planId || !jwsRepresentation) {
      return NextResponse.json(
        { success: false, error: "Missing planId or jwsRepresentation" },
        { status: 400 }
      )
    }

    // Step 1: Verify JWS cryptographically
    const txn = await verifyStoreKit2Transaction(jwsRepresentation)

    // Step 2: Validate expiration
    if (txn.expiresDate && txn.expiresDate < Date.now()) {
      return NextResponse.json(
        { success: false, error: "Transaction has already expired" },
        { status: 400 }
      )
    }

    // Step 3: Match plan in database
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Selected plan not found" },
        { status: 404 }
      )
    }

    if (plan.type !== authResult.sellerType) {
      return NextResponse.json(
        { success: false, error: "Plan type does not match seller type" },
        { status: 400 }
      )
    }

    if (plan.appleProductId && txn.productId && plan.appleProductId !== txn.productId) {
      return NextResponse.json(
        { success: false, error: "Purchased Apple product does not match requested plan" },
        { status: 400 }
      )
    }

    // Step 4 & 5: Anti-fraud and Database Activation
    const subscription = await activateAppleIapSubscription(authResult, plan, txn)

    return NextResponse.json({
      success: true,
      message: "Subscription verified and activated successfully.",
      subscription,
    })
  } catch (error: any) {
    console.error("[AppleIAP] Error verifying purchase:", error)
    const isConflict = error.message?.includes("already registered to another seller")
    return NextResponse.json(
      { success: false, error: error.message || "Failed to verify purchase" },
      { status: isConflict ? 409 : 500 }
    )
  }
}

/**
 * Handler for POST /mobileapi/seller/iap/restore
 * (Mandatory for Apple App Store Review Guideline 3.1.1)
 */
export async function handleRestorePurchase(request: NextRequest) {
  try {
    const authResult = await getUnifiedMobileSellerAuth(request)
    if (authResult.ok === false) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { jwsRepresentation } = body

    if (!jwsRepresentation) {
      return NextResponse.json(
        { success: false, error: "Missing jwsRepresentation" },
        { status: 400 }
      )
    }

    // Step 1: Verify JWS
    const txn = await verifyStoreKit2Transaction(jwsRepresentation)
    const originalTransactionId = txn.originalTransactionId
    if (!originalTransactionId) {
      return NextResponse.json(
        { success: false, error: "Missing originalTransactionId in token" },
        { status: 400 }
      )
    }

    // Step 2: Check if transaction has expired
    if (txn.expiresDate && txn.expiresDate < Date.now()) {
      return NextResponse.json(
        { success: false, error: "The restored subscription has expired" },
        { status: 400 }
      )
    }

    // Step 3: Find corresponding plan by appleProductId or fallback to existing active plan
    let plan = await prisma.plan.findFirst({
      where: {
        type: authResult.sellerType,
        appleProductId: txn.productId,
      },
    })

    if (!plan) {
      // Check if seller previously had a subscription matching this transaction
      const existingSub = await getCurrentSellerSubscription(authResult)
      if (existingSub?.plan && (existingSub as any).originalTransactionId === originalTransactionId) {
        plan = (existingSub as any).plan
      }
    }

    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          error: `No matching subscription plan configured for Apple Product ID "${txn.productId}". Please contact support.`,
        },
        { status: 404 }
      )
    }

    // Step 4: Restore & Activate
    const subscription = await activateAppleIapSubscription(authResult, plan, txn)

    return NextResponse.json({
      success: true,
      message: "Subscription successfully restored.",
      subscription,
    })
  } catch (error: any) {
    console.error("[AppleIAP] Error restoring purchase:", error)
    const isConflict = error.message?.includes("already registered to another seller")
    return NextResponse.json(
      { success: false, error: error.message || "Failed to restore purchase" },
      { status: isConflict ? 409 : 500 }
    )
  }
}

/**
 * Handler for POST /api/webhooks/apple-iap
 * (App Store Server Notifications v2)
 */
export async function handleAppleWebhook(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body?.signedPayload) {
      return NextResponse.json({ error: "Missing signedPayload" }, { status: 400 })
    }

    // Decode top-level notification
    const notification = await verifyAndDecodeNotification(body.signedPayload)
    const { notificationType, subtype, notificationUUID, data } = notification

    const effectiveUuid =
      notificationUUID?.trim() ||
      `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    console.log(
      `[Apple ASSN v2] Received event: ${notificationType} (subtype: ${subtype || "none"}, uuid: ${effectiveUuid})`
    )

    // Check duplicate delivery
    const existing = await prisma.appleIapEvent.findUnique({
      where: { notificationUuid: effectiveUuid },
      select: { id: true },
    })
    if (existing) {
      console.log(`[Apple ASSN v2] Duplicate notification ${effectiveUuid} already processed.`)
      return NextResponse.json({ received: true, duplicate: true })
    }

    let txn: any = null
    if (data?.signedTransactionInfo) {
      try {
        txn = await verifyStoreKit2Transaction(data.signedTransactionInfo)
      } catch (err) {
        console.error("[Apple ASSN v2] Failed to decode inner signedTransactionInfo:", err)
      }
    }

    const origTxnId = txn?.originalTransactionId

    // Log to apple_iap_events audit table with concurrency protection
    try {
      await prisma.appleIapEvent.create({
        data: {
          notificationUuid: effectiveUuid,
          notificationType: notificationType || "UNKNOWN",
          subtype: subtype || null,
          originalTransactionId: origTxnId || "UNKNOWN",
          transactionId: txn?.transactionId || null,
          environment: data?.environment || null,
          rawPayload: notification as any,
        },
      })
    } catch (createErr: any) {
      // P2002: Unique constraint violation (e.g. concurrent webhook retry)
      if (createErr?.code === "P2002") {
        console.log(`[Apple ASSN v2] Concurrent duplicate notification ${effectiveUuid} safely ignored.`)
        return NextResponse.json({ received: true, duplicate: true })
      }
      console.error("[Apple ASSN v2] Failed to log event to apple_iap_events:", createErr)
    }

    if (!origTxnId) {
      return NextResponse.json({ received: true })
    }

    // Apply DB mutation across whichever table has this originalTransactionId
    const updatePayload: Record<string, any> = {}

    switch (notificationType) {
      case "SUBSCRIBED":
      case "DID_RENEW":
        updatePayload.status = SubscriptionStatus.ACTIVE
        if (txn?.expiresDate) {
          updatePayload.currentPeriodEnd = new Date(txn.expiresDate)
        }
        if (txn?.transactionId) {
          updatePayload.latestTransactionId = txn.transactionId
        }
        updatePayload.autoRenew = true
        break

      case "DID_FAIL_TO_RENEW":
        // Set grace period if Apple's grace period is active
        updatePayload.status = SubscriptionStatus.IN_GRACE_PERIOD
        break

      case "EXPIRED":
        // Terminate paid subscription - DO NOT convert to free tier!
        updatePayload.status = SubscriptionStatus.EXPIRED
        updatePayload.autoRenew = false
        break

      case "REFUND":
      case "REVOKE":
        updatePayload.status = SubscriptionStatus.REVOKED
        updatePayload.autoRenew = false
        break

      default:
        console.log(`[Apple ASSN v2] No DB action required for event type: ${notificationType}`)
        break
    }

    if (Object.keys(updatePayload).length > 0) {
      await Promise.all([
        prisma.subscription.updateMany({
          where: { originalTransactionId: origTxnId },
          data: updatePayload,
        }),
        prisma.hotelSubscription.updateMany({
          where: { originalTransactionId: origTxnId },
          data: updatePayload,
        }),
        prisma.restaurantSubscription.updateMany({
          where: { originalTransactionId: origTxnId },
          data: updatePayload,
        }),
      ])
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("[Apple ASSN v2] Webhook error:", error)
    // Always return 200 to prevent Apple from retrying continuously on business errors
    return NextResponse.json({ received: true, error: error.message }, { status: 200 })
  }
}
