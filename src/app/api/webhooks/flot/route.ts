import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyFlotWebhookBasicAuth } from "@/lib/flot"

export const dynamic = "force-dynamic"

/**
 * Flot Payment Gateway Webhook Handler
 * Authenticated via HTTP Basic Authentication.
 * Processes notifications idempotently.
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
      // Check Subscriptions across models
      const [sub, hotelSub, restSub] = await Promise.all([
        prisma.subscription.findFirst({ where: { flotOrderId: orderId }, include: { plan: true } }),
        prisma.hotelSubscription.findFirst({ where: { flotOrderId: orderId }, include: { plan: true } }),
        prisma.restaurantSubscription.findFirst({ where: { flotOrderId: orderId }, include: { plan: true } }),
      ]);

      const now = new Date();

      if (sub) {
        if (status === "completed") {
          const durationDays = sub.plan?.duration || 30;
          const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: "ACTIVE",
              provider: "flot",
              paymentMethod: "FLOAT",
              paidAt: sub.paidAt || now,
              currentPeriodStart: sub.currentPeriodStart || now,
              currentPeriodEnd: periodEnd,
            },
          });
          console.log(`[Flot Webhook] Subscription ${sub.id} marked ACTIVE via Float`);
        } else if (status === "failed" && sub.status !== "ACTIVE") {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: "CANCELED" },
          });
        }
        return NextResponse.json({ success: true, type: "subscription" });
      }

      if (hotelSub) {
        if (status === "completed") {
          const durationDays = hotelSub.plan?.duration || 30;
          const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
          await prisma.hotelSubscription.update({
            where: { id: hotelSub.id },
            data: {
              status: "ACTIVE",
              provider: "flot",
              paymentMethod: "FLOAT",
              paidAt: hotelSub.paidAt || now,
              currentPeriodStart: hotelSub.currentPeriodStart || now,
              currentPeriodEnd: periodEnd,
            },
          });
          console.log(`[Flot Webhook] HotelSubscription ${hotelSub.id} marked ACTIVE via Float`);
        } else if (status === "failed" && hotelSub.status !== "ACTIVE") {
          await prisma.hotelSubscription.update({
            where: { id: hotelSub.id },
            data: { status: "CANCELED" },
          });
        }
        return NextResponse.json({ success: true, type: "hotel_subscription" });
      }

      if (restSub) {
        if (status === "completed") {
          const durationDays = restSub.plan?.duration || 30;
          const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
          await prisma.restaurantSubscription.update({
            where: { id: restSub.id },
            data: {
              status: "ACTIVE",
              provider: "flot",
              paymentMethod: "FLOAT",
              paidAt: restSub.paidAt || now,
              currentPeriodStart: restSub.currentPeriodStart || now,
              currentPeriodEnd: periodEnd,
            },
          });
          console.log(`[Flot Webhook] RestaurantSubscription ${restSub.id} marked ACTIVE via Float`);
        } else if (status === "failed" && restSub.status !== "ACTIVE") {
          await prisma.restaurantSubscription.update({
            where: { id: restSub.id },
            data: { status: "CANCELED" },
          });
        }
        return NextResponse.json({ success: true, type: "restaurant_subscription" });
      }

      console.warn(`[Flot Webhook] No SellerAd or Subscription found with flotOrderId: ${orderId}`);
      return NextResponse.json({ success: true, note: "Order not found" });
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
      });
      console.log(`[Flot Webhook] SellerAd ${ad.id} marked COMPLETED`);
    } else if (status === "failed") {
      if (ad.paymentStatus !== "COMPLETED") {
        await prisma.sellerAd.update({
          where: { id: ad.id },
          data: {
            paymentStatus: "FAILED",
            flotRequestId: flotRequestId || ad.flotRequestId,
          },
        });
        console.log(`[Flot Webhook] SellerAd ${ad.id} marked FAILED`);
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Flot Webhook] Error processing webhook:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
