import { NextRequest, NextResponse } from "next/server"
import { resolveInvoiceActor, verifyQrAndFetchInvoiceData } from "@/lib/invoice-auth"
import { createInvoicePdfDownloadToken, resolveAppBaseUrl } from "@/lib/invoice-qr"
import { getRequestPublicOrigin } from "@/lib/media-url"

export const dynamic = "force-dynamic"

async function handleVerify(request: NextRequest, rawQrInput: string) {
  try {
    const actor = await resolveInvoiceActor(request)
    const origin = getRequestPublicOrigin(request)
    const result = await verifyQrAndFetchInvoiceData({
      rawQrInput,
      actor,
      requestOrigin: origin,
    })

    if (!result.ok) {
      return NextResponse.json(
        { success: false, verified: false, error: result.error },
        { status: result.status }
      )
    }

    const baseUrl = resolveAppBaseUrl(origin)
    const isCustomerOwner = actor?.kind === "CUSTOMER" && result.order.customerId === actor.userId
    let signedPdfUrl: string | null = null
    if (isCustomerOwner && actor) {
      const dlToken = createInvoicePdfDownloadToken({
        orderId: result.order.id,
        userId: actor.userId,
        role: "CUSTOMER",
      })
      signedPdfUrl = `${baseUrl}/mobileapi/customer/orders/${result.order.id}/invoice/pdf?dlToken=${encodeURIComponent(
        dlToken
      )}`
    }

    const invoices = result.invoices.map((inv) => {
      if (!isCustomerOwner || !actor) {
        return {
          ...inv,
          pdfDownloadUrl: undefined,
          signedPdfUrl: undefined,
        }
      }
      const sellerId = inv.seller.sellerId ?? null
      const sellerQuery = sellerId ? `sellerId=${encodeURIComponent(sellerId)}&` : ""
      const invDlToken = createInvoicePdfDownloadToken({
        orderId: result.order.id,
        userId: actor.userId,
        role: "CUSTOMER",
        sellerId,
      })
      return {
        ...inv,
        pdfDownloadUrl: `/mobileapi/customer/orders/${result.order.id}/invoice/pdf${
          sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : ""
        }`,
        signedPdfUrl: `${baseUrl}/mobileapi/customer/orders/${result.order.id}/invoice/pdf?${sellerQuery}dlToken=${encodeURIComponent(
          invDlToken
        )}`,
      }
    })

    return NextResponse.json({
      success: true,
      verified: true,
      message: "Invoice QR verified successfully",
      data: {
        verificationMode: result.verificationMode,
        isPublicMasked: result.isPublicMasked,
        isOwner: isCustomerOwner,
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        invoiceCount: invoices.length,
        pdfDownloadUrl: isCustomerOwner
          ? `/mobileapi/customer/orders/${result.order.id}/invoice/pdf`
          : null,
        signedPdfUrl,
        invoice: invoices[0],
        invoices,
      },
    })
  } catch (error) {
    console.error("Mobile invoice verify error:", error)
    return NextResponse.json(
      { success: false, verified: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET /mobileapi/invoice/verify?t=<token> or ?qr=<qrData>
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const rawQrInput =
    sp.get("t") || sp.get("token") || sp.get("qr") || sp.get("qrData") || sp.get("code") || ""
  return handleVerify(request, rawQrInput)
}

/**
 * POST /mobileapi/invoice/verify
 * Body: { qrData: string } (also accepts { qr }, { token }, { code }, { orderNumber })
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { success: false, verified: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const rawQrInput =
    (typeof body.qrData === "string" && body.qrData) ||
    (typeof body.qr === "string" && body.qr) ||
    (typeof body.token === "string" && body.token) ||
    (typeof body.t === "string" && body.t) ||
    (typeof body.code === "string" && body.code) ||
    (typeof body.orderNumber === "string" && body.orderNumber) ||
    ""

  return handleVerify(request, rawQrInput)
}
