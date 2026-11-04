import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyFlotWebhookBasicAuth } from "@/lib/flot"
import { activateOrQueuePurchase } from "@/lib/subscriptions"
import { PlanType } from "@prisma/client"

export const dynamic = "force-dynamic"

/**
 * Flot Payment Gateway Webhook Handler
 * Authenticated via HTTP Basic Authentication.
 * Processes notifications idempotently via universal activateOrQueuePurchase.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")

  if (!verifyFlotWebhookBasicAuth(authHeader)) {
    console.warn("[Flot Webhook] Unauthorized webhook attempt")
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Flot Webhook"' },
    })
  }

  let body: any
  try {
    body = await request.json()
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { orderId, flotRequestId, status } = body || {}

  if (!orderId || !status) {
    return NextResponse.json(
      { error: "orderId and status are required" },
      { status: 400 }
    )
  }

  console.log(`[Flot Webhook] Received notification for orderId=${orderId}, status=${status}, flotRequestId=${flotRequestId}`)

  try {
    const ad = await prisma.sellerAd.findFirst({
      where: {
        OR: [
          { flotOrderId: orderId },
          { flotInternalOrderId: orderId },
          ...(flotRequestId ? [{ flotRequestId }] : []),
        ],
      },
    })

    if (!ad) {
      // 1. Check universal SubscriptionPurchase ledger first
      const purchase = await prisma.subscriptionPurchase.findFirst({
        where: { flotOrderId: orderId },
        include: { plan: true },
      })

      if (purchase) {
        if (status === "completed") {
          await activateOrQueuePurchase({
            purchaseId: purchase.id,
            sellerType: purchase.sellerType,
            sellerId: purchase.sellerId,
            hotelSellerId: purchase.hotelSellerId,
            restaurantSellerId: purchase.restaurantSellerId,
            planId: purchase.planId,
            price: purchase.price,
            paidPrice: purchase.paidPrice,
            durationDays: purchase.durationDays,
            paymentMethod: "FLOAT",
            flotOrderId: orderId,
            paidAt: new Date(),
          })
          console.log(`[Flot Webhook] SubscriptionPurchase ${purchase.id} activated/queued via Float`)
        } else if (status === "failed") {
          await prisma.subscriptionPurchase.update({
            where: { id: purchase.id },
            data: { status: "FAILED" },
          })
          console.log(`[Flot Webhook] SubscriptionPurchase ${purchase.id} marked FAILED (active subscription untouched)`)
        }
        return NextResponse.json({ success: true, type: "subscription_purchase" })
      }

      // 2. Fallback check legacy subscription cache tables
      const [sub, hotelSub, restSub] = await Promise.all([
        prisma.subscription.findFirst({ where: { flotOrderId: orderId }, include: { plan: true } }),
        prisma.hotelSubscription.findFirst({ where: { flotOrderId: orderId }, include: { plan: true } }),
        prisma.restaurantSubscription.findFirst({ where: { flotOrderId: orderId }, include: { plan: true } }),
      ])

      if (sub) {
        if (status === "completed") {
          await activateOrQueuePurchase({
            sellerType: PlanType.PRODUCT_SERVICE,
            sellerId: sub.sellerId,
            planId: sub.planId,
            price: sub.plan.price,
            paidPrice: sub.plan.price,
            durationDays: sub.plan.duration || 30,
            paymentMethod: "FLOAT",
            flotOrderId: orderId,
            paidAt: new Date(),
          })
          console.log(`[Flot Webhook] Subscription ${sub.id} activated/queued via Float`)
        }
        return NextResponse.json({ success: true, type: "subscription" })
      }

      if (hotelSub) {
        if (status === "completed") {
          await activateOrQueuePurchase({
            sellerType: PlanType.HOTEL,
            hotelSellerId: hotelSub.hotelSellerId,
            planId: hotelSub.planId,
            price: hotelSub.plan.price,
            paidPrice: hotelSub.plan.price,
            durationDays: hotelSub.plan.duration || 30,
            paymentMethod: "FLOAT",
            flotOrderId: orderId,
            paidAt: new Date(),
          })
          console.log(`[Flot Webhook] HotelSubscription ${hotelSub.id} activated/queued via Float`)
        }
        return NextResponse.json({ success: true, type: "hotel_subscription" })
      }

      if (restSub) {
        if (status === "completed") {
          await activateOrQueuePurchase({
            sellerType: PlanType.RESTAURANT,
            restaurantSellerId: restSub.restaurantSellerId,
            planId: restSub.planId,
            price: restSub.plan.price,
            paidPrice: restSub.plan.price,
            durationDays: restSub.plan.duration || 30,
            paymentMethod: "FLOAT",
            flotOrderId: orderId,
            paidAt: new Date(),
          })
          console.log(`[Flot Webhook] RestaurantSubscription ${restSub.id} activated/queued via Float`)
        }
        return NextResponse.json({ success: true, type: "restaurant_subscription" })
      }

      console.warn(`[Flot Webhook] No SellerAd or Subscription found with flotOrderId: ${orderId}`)
      return NextResponse.json({ success: true, note: "Order not found" })
    }

    if (status === "completed") {
      await prisma.sellerAd.update({
        where: { id: ad.id },
        data: {
          paymentStatus: "COMPLETED",
          paymentMethod: "FLOAT",
          flotRequestId: flotRequestId || ad.flotRequestId,
          paidAt: ad.paidAt || new Date(),
        },
      })
      console.log(`[Flot Webhook] SellerAd ${ad.id} marked COMPLETED`)
    } else if (status === "failed") {
      if (ad.paymentStatus !== "COMPLETED") {
        await prisma.sellerAd.update({
          where: { id: ad.id },
          data: {
            paymentStatus: "FAILED",
            flotRequestId: flotRequestId || ad.flotRequestId,
          },
        })
        console.log(`[Flot Webhook] SellerAd ${ad.id} marked FAILED`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Flot Webhook] Error processing webhook:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
