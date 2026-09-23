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
    const ad = await prisma.sellerAd.findUnique({
      where: { flotOrderId: orderId },
    })

    if (!ad) {
      console.warn(`[Flot Webhook] No SellerAd found with flotOrderId: ${orderId}`)
      // Still return 200 to acknowledge receipt as required by Float spec
      return NextResponse.json({ success: true, note: "Order not found" })
    }

    if (status === "completed") {
      await prisma.sellerAd.update({
        where: { id: ad.id },
        data: {
          paymentStatus: "COMPLETED",
          flotRequestId: flotRequestId || ad.flotRequestId,
          paidAt: ad.paidAt || new Date(),
        },
      })
      console.log(`[Flot Webhook] SellerAd ${ad.id} marked COMPLETED`)
    } else if (status === "failed") {
      // If previously completed, do not overwrite; otherwise mark FAILED
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
