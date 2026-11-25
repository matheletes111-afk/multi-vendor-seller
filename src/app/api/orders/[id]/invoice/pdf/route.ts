import { NextRequest, NextResponse } from "next/server"
import { resolveInvoiceActor, authorizeActorForOrder } from "@/lib/invoice-auth"
import { verifyInvoicePdfDownloadToken } from "@/lib/invoice-qr"
import { buildOrderInvoices } from "@/lib/order-invoice"
import { generateOrderInvoicePdf } from "@/lib/invoice-pdf"
import { getRequestPublicOrigin } from "@/lib/media-url"

export const dynamic = "force-dynamic"

/**
 * GET /api/orders/[id]/invoice/pdf
 * Generates and downloads a real A4 PDF tax invoice for the order (or specific sellerId).
 * Supports Web session cookies, Mobile Bearer token, or short-lived signed `dlToken`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params
  const { searchParams } = new URL(request.url)
  let filterSellerId = searchParams.get("sellerId")
  const disposition = searchParams.get("disposition") === "inline" ? "inline" : "attachment"
  const dlToken = searchParams.get("dlToken")

  let allowedSellerId: string | null = null
  let dlTokenUserCheck: { userId: string; role: string } | null = null

  const origin = getRequestPublicOrigin(request)

  if (dlToken) {
    const tokenInfo = verifyInvoicePdfDownloadToken(dlToken)
    if (!tokenInfo.valid || tokenInfo.orderId !== orderId) {
      return NextResponse.json({ error: "Invalid or expired download token" }, { status: 401 })
    }
    dlTokenUserCheck = { userId: tokenInfo.userId, role: tokenInfo.role }
    if (tokenInfo.sellerId) {
      filterSellerId = tokenInfo.sellerId
    }
  } else {
    const actor = await resolveInvoiceActor(request)
    if (!actor || actor.kind === "RIDER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const builtCheck = await buildOrderInvoices(orderId, {
      includeQrDataUrl: false,
      baseUrl: origin,
    })
    if (!builtCheck) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }
    const authz = await authorizeActorForOrder(actor, builtCheck.order)
    if (!authz.allowed) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 })
    }
    allowedSellerId = authz.allowedSellerId
  }

  const built = await buildOrderInvoices(orderId, {
    allowedSellerId,
    filterSellerId,
    baseUrl: origin,
    includeQrDataUrl: false,
  })

  if (!built || built.invoices.length === 0) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  if (dlTokenUserCheck?.role === "CUSTOMER" && built.order.customerId !== dlTokenUserCheck.userId) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 })
  }

  try {
    const pdfBytes = await generateOrderInvoicePdf(built.invoices)
    const safeOrderNumber = built.order.orderNumber.replace(/[^A-Za-z0-9_-]/g, "")
    const filename = `MEEEM-Invoice-${safeOrderNumber}.pdf`

    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("Failed to generate invoice PDF:", err)
    return NextResponse.json({ error: "Failed to generate invoice PDF" }, { status: 500 })
  }
}
