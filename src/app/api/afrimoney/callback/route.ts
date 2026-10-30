import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * AfriMoney Payment Webhook Callback Endpoint
 *
 * Configured URL: https://www.meeemsl.com/api/afrimoney/callback
 * Method: POST
 * Content-Type: application/json
 *
 * Fully covers ALL 4 seller types & customer checkout categories:
 * 1. "FOOD_" or "F-"   ➔ Food / Restaurant Orders (FoodOrder)
 * 2. "HOTEL_"          ➔ Hotel Room Bookings (HotelBooking)
 * 3. "AD_"             ➔ Seller Ads (Product, Hotel, Restaurant, Service via SellerAd)
 * 4. "SUB_"            ➔ All 4 Seller Subscriptions:
 *                         - Product & Service Sellers (Subscription)
 *                         - Hotel Sellers (HotelSubscription)
 *                         - Restaurant Sellers (RestaurantSubscription)
 * 5. "ORD_" or "meeem" ➔ Product & Service Orders (Order & OrderItem)
 * 6. (Raw / No prefix) ➔ Safe sequential fallback matching
 */
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch (err) {
    console.warn("[AfriMoney Callback] Received non-JSON or empty payload")
    return NextResponse.json(
      { status: 400, message: "Invalid JSON payload" },
      { status: 400 }
    )
  }

  console.log("[AfriMoney Callback] Received payload:", JSON.stringify(body))

  const ftxnId = (
    body.ftxn_id ||
    body.ftxnId ||
    body.external_reference_id ||
    body.externalReferenceId ||
    body.reference_id ||
    ""
  ).toString().trim()

  const transactionId = (
    body.transaction_id ||
    body.MMTransactionID ||
    body.txnID ||
    body.transactionId ||
    ""
  ).toString().trim()

  const rawStatus = (
    body.txn_status ||
    body.txnStatus ||
    body.status ||
    ""
  ).toString().trim()

  const amount = body.amount || body.Amount || null
  const payerMsisdn = body.payer_msisdn || body.SenderMSISDN || body.senderMSISDN || ""

  const normalizedStatus = rawStatus.toUpperCase()
  const isSuccess =
    normalizedStatus === "TS" ||
    normalizedStatus === "SUCCESS" ||
    normalizedStatus === "SUCCEEDED" ||
    normalizedStatus === "200"

  const isFailed =
    normalizedStatus === "TF" ||
    normalizedStatus.includes("FAIL") ||
    normalizedStatus.includes("CANCEL") ||
    normalizedStatus.includes("TIMEOUT")

  // Determine explicit target category from reference prefix to eliminate any cross-collision
  let targetCategory:
    | "PRODUCT_SERVICE"
    | "FOOD"
    | "HOTEL"
    | "AD"
    | "SUBSCRIPTION"
    | "AUTO" = "AUTO"
  let cleanId = ftxnId

  if (ftxnId.startsWith("FOOD_") || ftxnId.startsWith("F-")) {
    targetCategory = "FOOD"
    cleanId = ftxnId.replace(/^FOOD_/, "")
  } else if (ftxnId.startsWith("HOTEL_")) {
    targetCategory = "HOTEL"
    cleanId = ftxnId.replace(/^HOTEL_/, "")
  } else if (ftxnId.startsWith("AD_")) {
    targetCategory = "AD"
    cleanId = ftxnId.replace(/^AD_/, "")
  } else if (
    ftxnId.startsWith("SUB_") ||
    ftxnId.startsWith("SUB_HOTEL_") ||
    ftxnId.startsWith("SUB_REST_")
  ) {
    targetCategory = "SUBSCRIPTION"
    cleanId = ftxnId
      .replace(/^SUB_HOTEL_/, "")
      .replace(/^SUB_REST_/, "")
      .replace(/^SUB_/, "")
  } else if (ftxnId.startsWith("ORD_") || ftxnId.startsWith("meeem")) {
    targetCategory = "PRODUCT_SERVICE"
    cleanId = ftxnId.replace(/^ORD_/, "")
  }

  let matchedCategory: string | null = null

  try {
    if (ftxnId) {
      // ──────────────────────────────────────────────────────────────────────────
      // 1. FOOD / RESTAURANT ORDERS (If FOOD_ prefix or AUTO)
      // ──────────────────────────────────────────────────────────────────────────
      if (targetCategory === "FOOD" || targetCategory === "AUTO") {
        const foodOrder = await prisma.foodOrder.findFirst({
          where: {
            OR: [{ id: cleanId }, { orderNumber: cleanId }, { orderNumber: ftxnId }],
          },
        })

        if (foodOrder) {
          matchedCategory = "FOOD_ORDER"
          console.log(`[AfriMoney Callback] Matched Food Order ${foodOrder.orderNumber} (id: ${foodOrder.id})`)

          await prisma.foodOrder.update({
            where: { id: foodOrder.id },
            data: {
              status: isSuccess
                ? "CONFIRMED"
                : isFailed
                ? "CANCELLED"
                : foodOrder.status,
            },
          })
        }
      }

      // ──────────────────────────────────────────────────────────────────────────
      // 2. SELLER ADS (Product, Hotel, Restaurant, Service Sellers via SellerAd)
      // ──────────────────────────────────────────────────────────────────────────
      if (!matchedCategory && (targetCategory === "AD" || targetCategory === "AUTO")) {
        const ad = await prisma.sellerAd
          .findFirst({
            where: {
              OR: [
                { id: cleanId },
                { afriTxnId: cleanId },
                { afriFtxnId: ftxnId },
                { flotOrderId: cleanId },
                { flotOrderId: ftxnId },
              ],
            },
          })
          .catch(() => null)

        if (ad) {
          matchedCategory = "SELLER_AD"
          console.log(`[AfriMoney Callback] Matched SellerAd ${ad.id} (sellerId: ${ad.sellerId || ad.hotelSellerId || ad.restaurantSellerId || "customer"}, ftxnId: ${ftxnId})`)

          await prisma.sellerAd.update({
            where: { id: ad.id },
            data: {
              paymentStatus: isSuccess ? "COMPLETED" : isFailed ? "FAILED" : ad.paymentStatus,
              paymentMethod: "AFRIMONEY",
              paidAt: isSuccess ? (ad.paidAt || new Date()) : ad.paidAt,
              afriFtxnId: ftxnId || transactionId || ad.afriFtxnId,
              afriMsisdn: payerMsisdn || body.msisdn || ad.afriMsisdn,
            },
          })
        }
      }

      // ──────────────────────────────────────────────────────────────────────────
      // 3. HOTEL ROOM BOOKINGS (If HOTEL_ prefix or AUTO)
      // ──────────────────────────────────────────────────────────────────────────
      if (!matchedCategory && (targetCategory === "HOTEL" || targetCategory === "AUTO")) {
        const booking = await prisma.hotelBooking
          .findUnique({ where: { id: cleanId } })
          .catch(() => null)

        if (booking) {
          matchedCategory = "HOTEL_BOOKING"
          console.log(`[AfriMoney Callback] Matched Hotel Booking (id: ${booking.id})`)

          await prisma.hotelBooking.update({
            where: { id: booking.id },
            data: {
              status: isSuccess
                ? "CONFIRMED"
                : isFailed
                ? "CANCELLED"
                : booking.status,
            },
          })
        }
      }

      // ──────────────────────────────────────────────────────────────────────────
      // 4. SELLER SUBSCRIPTIONS (Cross-checked across ALL 4 Sellers)
      // ──────────────────────────────────────────────────────────────────────────
      if (!matchedCategory && (targetCategory === "SUBSCRIPTION" || targetCategory === "AUTO")) {
        // 4A. Product & Service Sellers (Subscription table)
        const sub = await prisma.subscription.findFirst({
          where: {
            OR: [{ id: cleanId }, { sellerId: cleanId }],
          },
        }).catch(() => null)

        if (sub) {
          matchedCategory = "PRODUCT_OR_SERVICE_SELLER_SUBSCRIPTION"
          console.log(`[AfriMoney Callback] Matched Product/Service Seller Subscription (id: ${sub.id})`)

          const now = new Date()
          const periodEnd = sub.currentPeriodEnd && sub.currentPeriodEnd > now
            ? new Date(sub.currentPeriodEnd.getTime() + 30 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: isSuccess ? "ACTIVE" : isFailed ? "CANCELED" : sub.status,
              provider: "afrimoney",
              latestTransactionId: transactionId || sub.latestTransactionId,
              paidPrice: amount ? Number(amount) : sub.paidPrice,
              currentPeriodStart: isSuccess ? (sub.currentPeriodStart || now) : sub.currentPeriodStart,
              currentPeriodEnd: isSuccess ? periodEnd : sub.currentPeriodEnd,
            },
          })
        }

        // 4B. Hotel Sellers (HotelSubscription table)
        if (!matchedCategory) {
          const hotelSub = await prisma.hotelSubscription.findFirst({
            where: {
              OR: [{ id: cleanId }, { hotelSellerId: cleanId }],
            },
          }).catch(() => null)

          if (hotelSub) {
            matchedCategory = "HOTEL_SELLER_SUBSCRIPTION"
            console.log(`[AfriMoney Callback] Matched Hotel Seller Subscription (id: ${hotelSub.id})`)

            const now = new Date()
            const periodEnd = hotelSub.currentPeriodEnd && hotelSub.currentPeriodEnd > now
              ? new Date(hotelSub.currentPeriodEnd.getTime() + 30 * 24 * 60 * 60 * 1000)
              : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

            await prisma.hotelSubscription.update({
              where: { id: hotelSub.id },
              data: {
                status: isSuccess ? "ACTIVE" : isFailed ? "CANCELED" : hotelSub.status,
                provider: "afrimoney",
                latestTransactionId: transactionId || hotelSub.latestTransactionId,
                paidPrice: amount ? Number(amount) : hotelSub.paidPrice,
                currentPeriodStart: isSuccess ? (hotelSub.currentPeriodStart || now) : hotelSub.currentPeriodStart,
                currentPeriodEnd: isSuccess ? periodEnd : hotelSub.currentPeriodEnd,
              },
            })
          }
        }

        // 4C. Restaurant Sellers (RestaurantSubscription table)
        if (!matchedCategory) {
          const restSub = await prisma.restaurantSubscription.findFirst({
            where: {
              OR: [{ id: cleanId }, { restaurantSellerId: cleanId }],
            },
          }).catch(() => null)

          if (restSub) {
            matchedCategory = "RESTAURANT_SELLER_SUBSCRIPTION"
            console.log(`[AfriMoney Callback] Matched Restaurant Seller Subscription (id: ${restSub.id})`)

            const now = new Date()
            const periodEnd = restSub.currentPeriodEnd && restSub.currentPeriodEnd > now
              ? new Date(restSub.currentPeriodEnd.getTime() + 30 * 24 * 60 * 60 * 1000)
              : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

            await prisma.restaurantSubscription.update({
              where: { id: restSub.id },
              data: {
                status: isSuccess ? "ACTIVE" : isFailed ? "CANCELED" : restSub.status,
                provider: "afrimoney",
                latestTransactionId: transactionId || restSub.latestTransactionId,
                paidPrice: amount ? Number(amount) : restSub.paidPrice,
                currentPeriodStart: isSuccess ? (restSub.currentPeriodStart || now) : restSub.currentPeriodStart,
                currentPeriodEnd: isSuccess ? periodEnd : restSub.currentPeriodEnd,
              },
            })
          }
        }
      }

      // ──────────────────────────────────────────────────────────────────────────
      // 5. PRODUCT & SERVICE ORDERS (Order & OrderItem)
      // ──────────────────────────────────────────────────────────────────────────
      if (!matchedCategory && (targetCategory === "PRODUCT_SERVICE" || targetCategory === "AUTO")) {
        const order = await prisma.order.findFirst({
          where: {
            OR: [{ id: cleanId }, { orderNumber: cleanId }, { orderNumber: ftxnId }],
          },
        })

        if (order) {
          matchedCategory = "PRODUCT_OR_SERVICE_ORDER"
          console.log(`[AfriMoney Callback] Matched Product/Service Order ${order.orderNumber} (id: ${order.id})`)

          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: isSuccess ? "COMPLETED" : isFailed ? "FAILED" : order.paymentStatus,
              status: isSuccess && order.status === "PENDING" ? "CONFIRMED" : order.status,
              paymentMethod: "AFRIMONEY",
            },
          })

          // Upsert Payment table record
          const existingPayment = await prisma.payment.findFirst({
            where: { orderId: order.id },
            orderBy: { createdAt: "desc" },
          })

          if (existingPayment) {
            await prisma.payment.update({
              where: { id: existingPayment.id },
              data: {
                status: isSuccess ? "COMPLETED" : isFailed ? "FAILED" : existingPayment.status,
                method: "AFRIMONEY",
                gatewayReferenceId: transactionId || existingPayment.gatewayReferenceId,
                metadata: body,
              },
            })
          } else {
            await prisma.payment.create({
              data: {
                orderId: order.id,
                amount: Number(amount) || order.totalAmount,
                status: isSuccess ? "COMPLETED" : isFailed ? "FAILED" : "PENDING",
                method: "AFRIMONEY",
                gatewayReferenceId: transactionId || null,
                metadata: body,
              },
            })
          }
        }
      }
    } else {
      console.warn("[AfriMoney Callback] Payload did not contain ftxn_id / external reference id")
    }

    // Always acknowledge with status code 200 as required by AfriMoney specification
    return NextResponse.json(
      {
        status: 200,
        message: "Callback received and processed successfully",
        data: {
          ftxn_id: ftxnId || null,
          targetCategory,
          matchedCategory: matchedCategory || "UNKNOWN_OR_UNMATCHED",
          transaction_id: transactionId || null,
          status: isSuccess ? "SUCCESS" : isFailed ? "FAILED" : rawStatus,
          payer_msisdn: payerMsisdn,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("[AfriMoney Callback] Internal processing error:", error)
    // Return 200 so AfriMoney does not retry indefinitely, but report warning in body
    return NextResponse.json(
      {
        status: 200,
        message: "Callback received but encountered internal error",
        error: error?.message || String(error),
      },
      { status: 200 }
    )
  }
}

/**
 * Health check for browser or manual testing of callback endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 200,
    service: "AfriMoney Webhook Callback",
    state: "ACTIVE",
    endpoint: "https://www.meeemsl.com/api/afrimoney/callback",
    supportedPrefixes: {
      "FOOD_ or F-": "Food / Restaurant Orders (FoodOrder)",
      "HOTEL_": "Hotel Room Bookings (HotelBooking)",
      "AD_": "Seller Ads (SellerAd: Product, Hotel, Restaurant, Service)",
      "SUB_": "Product & Service Seller Subscriptions (Subscription)",
      "SUB_HOTEL_": "Hotel Seller Subscriptions (HotelSubscription)",
      "SUB_REST_": "Restaurant Seller Subscriptions (RestaurantSubscription)",
      "ORD_ or meeem...": "Product & Service Orders (Order)",
    },
    supportedMethods: ["POST"],
    timestamp: new Date().toISOString(),
  })
}
