import { NextRequest, NextResponse } from "next/server"
import { getMobileCustomerAuth } from "@/app/mobileapi/_helpers/customer-auth"
import { buildOrderInvoices } from "@/lib/order-invoice"
import { createInvoicePdfDownloadToken, resolveAppBaseUrl } from "@/lib/invoice-qr"
import { getRequestPublicOrigin } from "@/lib/media-url"

export const dynamic = "force-dynamic"

/**
 * GET /mobileapi/customer/orders/[id]/invoice
 * Returns formatted invoice data (with delivery charge, region/zone, QR code data/image, and PDF links)
 * for an authenticated customer's order. Optional query: ?sellerId=<id>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getMobileCustomerAuth(request)
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Valid customer token required." },
      { status: 401 }
    )
  }

  const { id: orderId } = await params
  const filterSellerId = request.nextUrl.searchParams.get("sellerId")
  const origin = getRequestPublicOrigin(request)
  const baseUrl = resolveAppBaseUrl(origin)

  try {
    const built = await buildOrderInvoices(orderId, {
      filterSellerId,
      baseUrl: origin,
      pdfBasePath: `/mobileapi/customer/orders/${orderId}/invoice/pdf`,
    })

    if (!built) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    }

    if (built.order.customerId !== auth.userId) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    if (built.invoices.length === 0) {
      return NextResponse.json(
        { success: false, error: "No matching invoice found for this order" },
        { status: 404 }
      )
    }

    const orderDlToken = createInvoicePdfDownloadToken({
      orderId,
      userId: auth.userId,
      role: "CUSTOMER",
      sellerId: filterSellerId,
    })

    const sellerQuery = filterSellerId ? `sellerId=${encodeURIComponent(filterSellerId)}&` : ""
    const pdfDownloadUrl = `/mobileapi/customer/orders/${orderId}/invoice/pdf${
      filterSellerId ? `?sellerId=${encodeURIComponent(filterSellerId)}` : ""
    }`
    const signedPdfUrl = `${baseUrl}/mobileapi/customer/orders/${orderId}/invoice/pdf?${sellerQuery}dlToken=${encodeURIComponent(
      orderDlToken
    )}`

    const enrichedInvoices = built.invoices.map((inv) => {
      const invDlToken = createInvoicePdfDownloadToken({
        orderId,
        userId: auth.userId,
        role: "CUSTOMER",
        sellerId: inv.seller.sellerId ?? null,
      })
      const invSellerQuery = inv.seller.sellerId
        ? `sellerId=${encodeURIComponent(inv.seller.sellerId)}&`
        : ""
      return {
        ...inv,
        signedPdfUrl: `${baseUrl}/mobileapi/customer/orders/${orderId}/invoice/pdf?${invSellerQuery}dlToken=${encodeURIComponent(
          invDlToken
        )}`,
      }
    })

    const primary = enrichedInvoices[0]
    return NextResponse.json({
      success: true,
      message: "Invoice fetched successfully",
      data: {
        orderId: built.order.id,
        orderNumber: built.order.orderNumber,
        invoiceCount: enrichedInvoices.length,
        deliveryRegion: primary.deliveryRegion,
        deliveryZone: primary.deliveryZone,
        deliveryZoneLabel: primary.deliveryZoneLabel,
        pdfDownloadUrl,
        signedPdfUrl,
        verifyUrl: primary.qrVerifyUrl,
        invoices: enrichedInvoices,
      },
    })
  } catch (error) {
    console.error("Mobile customer invoice error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
