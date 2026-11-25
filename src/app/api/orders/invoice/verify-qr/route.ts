import { NextRequest, NextResponse } from "next/server"
import { resolveInvoiceActor, verifyQrAndFetchInvoiceData } from "@/lib/invoice-auth"
import { getRequestPublicOrigin } from "@/lib/media-url"

export const dynamic = "force-dynamic"

async function handleVerify(request: NextRequest, rawQrInput: string) {
  const actor = await resolveInvoiceActor(request)
  const result = await verifyQrAndFetchInvoiceData({
    rawQrInput,
    actor,
    requestOrigin: getRequestPublicOrigin(request),
  })

  if (!result.ok) {
    return NextResponse.json({ success: false, verified: false, error: result.error }, { status: result.status })
  }

  const primary = result.invoices[0]
  return NextResponse.json({
    success: true,
    verified: true,
    verificationMode: result.verificationMode,
    isPublicMasked: result.isPublicMasked,
    orderId: result.order.id,
    orderNumber: result.order.orderNumber,
    invoiceCount: result.invoices.length,
    invoice: primary,
    invoices: result.invoices,
  })
}

/**
 * GET /api/orders/invoice/verify-qr?t=<token> or ?qr=<qrData>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawQrInput =
    searchParams.get("t") ||
    searchParams.get("token") ||
    searchParams.get("qr") ||
    searchParams.get("qrData") ||
    searchParams.get("code") ||
    ""

  return handleVerify(request, rawQrInput)
}

/**
 * POST /api/orders/invoice/verify-qr
 * Body: { qrData?: string, token?: string, orderNumber?: string }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, verified: false, error: "Invalid JSON body" }, { status: 400 })
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
