import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyFlotWebhookBasicAuth } from "@/lib/flot"
import { activateOrQueuePurchase } from "@/lib/subscriptions"
import { creditHotelSellerForBooking } from "@/lib/hotel-ledger"
import { PlanType } from "@prisma/client"

export const dynamic = "force-dynamic"

/**
 * Flot Payment Gateway Universal Webhook Handler
 * Authenticated via HTTP Basic Authentication.
 * Processes notifications idempotently for Ads, Subscriptions, Product/Service Orders,
 * Food Orders, and Hotel Bookings.
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

  const orderId = (body?.orderId || body?.order_id || body?.externalOrderId || "") as string
  const flotRequestId = (body?.flotRequestId || body?.flot_request_id || body?.requestId || body?.request_id || null) as string | null
  const rawStatus = String(body?.status || body?.paymentStatus || body?.state || "").toLowerCase()
  const status = rawStatus === "completed" || rawStatus === "success" || rawStatus === "successful" ? "completed" : rawStatus

  if (!orderId || !status) {
    return NextResponse.json(
      { error: "orderId and status are required" },
      { status: 400 }
    )
  }

  console.log(`[Flot Webhook] Received notification for orderId=${orderId}, status=${status}, flotRequestId=${flotRequestId}`)

  try {
    // 1. Check SellerAd
    const ad = await prisma.sellerAd.findFirst({
      where: {
        OR: [
          { flotOrderId: orderId },
          { flotInternalOrderId: orderId },
          ...(flotRequestId ? [{ flotRequestId }] : []),
          ...(orderId.startsWith("AD_") ? [{ id: orderId.replace(/^AD_([a-zA-Z0-9]+_)?/, "") }] : []),
          { id: orderId },
        ],
      },
    })

    if (ad) {
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
      return NextResponse.json({ success: true, type: "ad" })
    }

    // 2. Check universal SubscriptionPurchase ledger
    const purchase = await prisma.subscriptionPurchase.findFirst({
      where: {
        OR: [
          { flotOrderId: orderId },
          { flotInternalOrderId: orderId },
          ...(flotRequestId ? [{ flotRequestId }] : []),
          ...(orderId.startsWith("SUB_") ? [{ id: orderId.replace(/^SUB_([a-zA-Z0-9]+_)?/, "") }] : []),
          { id: orderId },
        ],
      },
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
          discountAmount: purchase.discountAmount,
          couponCode: purchase.couponCode,
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

    // 3. Fallback check legacy subscription cache tables
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

    // 4. Check Product / Service Order (`ORD_` or flotOrderId or id)
    const productOrder = await prisma.order.findFirst({
      where: {
        OR: [
          { flotOrderId: orderId },
          { flotInternalOrderId: orderId },
          ...(flotRequestId ? [{ flotRequestId }] : []),
          ...(orderId.startsWith("ORD_") ? [{ id: orderId.replace(/^ORD_/, "") }] : []),
          { orderNumber: orderId },
          { id: orderId },
        ],
      },
    })

    if (productOrder) {
      if (status === "completed") {
        await prisma.order.update({
          where: { id: productOrder.id },
          data: {
            paymentStatus: "COMPLETED",
            paymentMethod: "FLOAT",
            status: productOrder.status === "PENDING" ? "CONFIRMED" : productOrder.status,
            flotOrderId: orderId,
            flotRequestId: flotRequestId || productOrder.flotRequestId,
            paidAt: productOrder.paidAt || new Date(),
          },
        })

        await prisma.orderItem.updateMany({
          where: { orderId: productOrder.id, itemStatus: "PENDING" },
          data: { itemStatus: "CONFIRMED", settlementStatus: "ESCROW_HELD" },
        })
        await prisma.orderItem.updateMany({
          where: { orderId: productOrder.id, settlementStatus: "PENDING" },
          data: { settlementStatus: "ESCROW_HELD" },
        })

        const orderLineItems = await prisma.orderItem.findMany({
          where: { orderId: productOrder.id },
          select: { id: true },
        })
        if (orderLineItems.length > 0) {
          await prisma.orderItemStatusHistory.createMany({
            data: orderLineItems.map((item) => ({
              orderItemId: item.id,
              status: "CONFIRMED",
              note: `Float card payment verified: ${orderId}`,
              location: "Flot Webhook",
            })),
          }).catch(() => null)
        }

        await prisma.cartItem.deleteMany({
          where: { userId: productOrder.customerId },
        }).catch(() => null)

        // Upsert Payment table record
        const existingPayment = await prisma.payment.findFirst({
          where: { orderId: productOrder.id },
          orderBy: { createdAt: "desc" },
        })

        if (existingPayment) {
          await prisma.payment.update({
            where: { id: existingPayment.id },
            data: {
              status: "COMPLETED",
              method: "FLOAT",
              gatewayReferenceId: orderId || existingPayment.gatewayReferenceId,
              metadata: body,
            },
          })
        } else {
          await prisma.payment.create({
            data: {
              orderId: productOrder.id,
              amount: productOrder.totalAmount,
              status: "COMPLETED",
              method: "FLOAT",
              gatewayReferenceId: orderId || null,
              metadata: body,
            },
          })
        }

        console.log(`[Flot Webhook] Product/Service Order ${productOrder.id} marked COMPLETED`)
      } else if (status === "failed") {
        if (productOrder.paymentStatus !== "COMPLETED") {
          console.log(`[Flot Webhook] Product/Service Order ${productOrder.id} payment attempt failed; left in pending state for customer retry`)
        }
      }
      return NextResponse.json({ success: true, type: "order" })
    }

    // 5. Check Restaurant FoodOrder (`FOOD_` or flotOrderId or id)
    const foodOrder = await prisma.foodOrder.findFirst({
      where: {
        OR: [
          { flotOrderId: orderId },
          { flotInternalOrderId: orderId },
          ...(flotRequestId ? [{ flotRequestId }] : []),
          ...(orderId.startsWith("FOOD_") ? [{ id: orderId.replace(/^FOOD_/, "") }] : []),
          { orderNumber: orderId },
          { id: orderId },
        ],
      },
    })

    if (foodOrder) {
      if (status === "completed") {
        await prisma.foodOrder.update({
          where: { id: foodOrder.id },
          data: {
            paymentStatus: "COMPLETED",
            paymentMethod: "FLOAT",
            status: "CONFIRMED",
            settlementStatus: "ESCROW_HELD",
            flotOrderId: orderId,
            flotRequestId: flotRequestId || foodOrder.flotRequestId,
            paidAt: foodOrder.paidAt || new Date(),
          },
        })
        console.log(`[Flot Webhook] FoodOrder ${foodOrder.id} marked COMPLETED`)
      } else if (status === "failed") {
        if (foodOrder.paymentStatus !== "COMPLETED") {
          console.log(`[Flot Webhook] FoodOrder ${foodOrder.id} payment attempt failed; left in pending state for customer retry`)
        }
      }
      return NextResponse.json({ success: true, type: "food_order" })
    }

    // 6. Check HotelBooking (`HOTEL_` or flotOrderId or id)
    const hotelBooking = await prisma.hotelBooking.findFirst({
      where: {
        OR: [
          { flotOrderId: orderId },
          { flotInternalOrderId: orderId },
          ...(flotRequestId ? [{ flotRequestId }] : []),
          ...(orderId.startsWith("HOTEL_") ? [{ id: orderId.replace(/^HOTEL_/, "") }] : []),
          { id: orderId },
        ],
      },
    })

    if (hotelBooking) {
      if (status === "completed") {
        await prisma.hotelBooking.update({
          where: { id: hotelBooking.id },
          data: {
            paymentStatus: "COMPLETED",
            paymentMethod: "FLOAT",
            status: "CONFIRMED",
            settlementStatus: "ESCROW_HELD",
            flotOrderId: orderId,
            flotRequestId: flotRequestId || hotelBooking.flotRequestId,
            paidAt: hotelBooking.paidAt || new Date(),
          },
        })

        await creditHotelSellerForBooking(prisma, hotelBooking.id).catch((err) =>
          console.error("[Flot Webhook] Error crediting hotel seller:", err)
        )
        console.log(`[Flot Webhook] HotelBooking ${hotelBooking.id} marked COMPLETED`)
      } else if (status === "failed") {
        if (hotelBooking.paymentStatus !== "COMPLETED") {
          console.log(`[Flot Webhook] HotelBooking ${hotelBooking.id} payment attempt failed; left in pending state for customer retry`)
        }
      }
      return NextResponse.json({ success: true, type: "hotel_booking" })
    }

    console.warn(`[Flot Webhook] No matching entity found with flotOrderId / prefix: ${orderId}`)
    return NextResponse.json({ success: true, note: "Order not found" })
  } catch (error: any) {
    console.error("[Flot Webhook] Error processing webhook:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
