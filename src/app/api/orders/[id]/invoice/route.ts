import { NextRequest, NextResponse } from "next/server"
import { resolveInvoiceActor, authorizeActorForOrder } from "@/lib/invoice-auth"
import { buildOrderInvoices } from "@/lib/order-invoice"
import { getRequestPublicOrigin } from "@/lib/media-url"

export const dynamic = "force-dynamic"

/**
 * GET /api/orders/[id]/invoice
 * Fetches formatted invoice data for an order (Web Session & Mobile Bearer supported).
 * Groups items by seller and returns a list of invoices including delivery charge,
 * delivery region/zone, QR code data, and PDF download link.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await resolveInvoiceActor(request)
  if (!actor || actor.kind === "RIDER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: orderId } = await params
  const { searchParams } = new URL(request.url)
  const filterSellerId = searchParams.get("sellerId")
  const origin = getRequestPublicOrigin(request)

  const built = await buildOrderInvoices(orderId, {
    baseUrl: origin,
    pdfBasePath: `/api/orders/${orderId}/invoice/pdf`,
  })

  if (!built) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const authz = await authorizeActorForOrder(actor, built.order)
  if (!authz.allowed) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 })
  }

  // Re-run filtering cleanly if seller-scoped or sellerId query filter was supplied
  const finalResult =
    authz.allowedSellerId || filterSellerId
      ? await buildOrderInvoices(orderId, {
          allowedSellerId: authz.allowedSellerId,
          filterSellerId,
          baseUrl: origin,
          pdfBasePath: `/api/orders/${orderId}/invoice/pdf`,
        })
      : built

  return NextResponse.json(finalResult?.invoices ?? [])
}
