import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { verifyInvoicePdfDownloadToken } from "@/lib/invoice-qr"
import { buildOrderInvoices } from "@/lib/order-invoice"
import { generateOrderInvoicePdf } from "@/lib/invoice-pdf"
import { getRequestPublicOrigin } from "@/lib/media-url"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/customer/orders/[id]/invoice/pdf
 * Downloads A4 PDF tax invoice for an authenticated customer's order.
 * Auth: Authorization: Bearer <customerToken> OR short-lived ?dlToken=<token>
 * Query: ?sellerId=<optional> & ?disposition=attachment|inline
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params
  const { searchParams } = request.nextUrl
  let filterSellerId = searchParams.get("sellerId")
  const disposition = searchParams.get("disposition") === "inline" ? "inline" : "attachment"
  const dlToken = searchParams.get("dlToken")

  let customerId: string | null = null

  if (dlToken) {
    const tokenRes = verifyInvoicePdfDownloadToken(dlToken)
    if (!tokenRes.valid || tokenRes.orderId !== orderId || tokenRes.role !== "CUSTOMER") {
      return NextResponse.json(
        { success: false, error: "Invalid or expired PDF download token" },
        { status: 401 }
      )
    }
    customerId = tokenRes.userId
    if (tokenRes.sellerId) {
      filterSellerId = tokenRes.sellerId
    }
  } else {
    const auth = await getMobileCustomerAuth(request)
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Valid customer token required." },
        { status: 401 }
      )
    }
    customerId = auth.userId
  }

  try {
    const built = await buildOrderInvoices(orderId, {
      filterSellerId,
      baseUrl: getRequestPublicOrigin(request),
      includeQrDataUrl: false,
    })

    if (!built) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    }

    if (built.order.customerId !== customerId) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    if (built.invoices.length === 0) {
      return NextResponse.json(
        { success: false, error: "No matching invoice found for this order" },
        { status: 404 }
      )
    }

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
  } catch (error) {
    console.error("Mobile customer invoice PDF error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate invoice PDF" },
      { status: 500 }
    )
  }
}
