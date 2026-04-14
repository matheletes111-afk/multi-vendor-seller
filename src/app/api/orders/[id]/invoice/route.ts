import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin, isProductSeller, isServiceSeller } from "@/lib/rbac"
import { InvoiceData, InvoiceItem } from "@/components/order/order-invoice"

/**
 * GET /api/orders/[id]/invoice
 * Fetches formatted invoice data for an order.
 * Groups items by seller and returns a list of invoices.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: orderId } = await params
  const { searchParams } = new URL(request.url)
  const filterSellerId = searchParams.get("sellerId")

  // 1. Fetch the raw order data with all associations needed for invoices
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { name: true, email: true } },
      items: {
        include: {
          seller: {
            include: {
              store: true,
              businessInfo: true,
            },
          },
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // 2. Permission Check
  const isUserAdmin = isAdmin(session.user)
  const isUserCustomer = session.user.role === "CUSTOMER" && order.customerId === session.user.id
  
  let allowedSellerId: string | null = null
  if (isProductSeller(session.user) || isServiceSeller(session.user)) {
    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    })
    allowedSellerId = seller?.id || null
  }

  // If not admin and not the customer, must be the seller of at least one item
  if (!isUserAdmin && !isUserCustomer && !allowedSellerId) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 })
  }

  // 3. Grouping Logic
  const sellerGroups = new Map<string, any>()

  for (const item of order.items) {
    // If seller is viewing, they can only see their own items
    if (allowedSellerId && item.sellerId !== allowedSellerId) continue
    
    // If a specific sellerId filter is passed (from detail page), apply it
    if (filterSellerId && item.sellerId !== filterSellerId) continue

    const sellerId = item.sellerId || "unknown"
    if (!sellerGroups.has(sellerId)) {
      sellerGroups.set(sellerId, {
        seller: item.seller,
        items: [],
      })
    }
    sellerGroups.get(sellerId).items.push(item)
  }

  // 4. Transform into InvoiceData array
  const invoices: InvoiceData[] = []

  for (const group of sellerGroups.values()) {
    const seller = group.seller
    const items: InvoiceItem[] = group.items.map((it: any) => ({
      id: it.id,
      productName: it.productNameSnapshot || it.serviceNameSnapshot || "Item",
      quantity: it.quantity,
      price: it.price,
      gstAmount: it.gstAmount,
      total: (it.subtotalInclGst ?? it.subtotal + it.gstAmount)
    }))

    const subtotal = items.reduce((sum, it) => sum + (it.price * it.quantity), 0)
    const gstTotal = items.reduce((sum, it) => sum + it.gstAmount, 0)
    const shippingCharge = group.items.reduce((sum: number, it: any) => sum + it.shippingAmount, 0)
    const grandTotal = items.reduce((sum, it) => sum + it.total, 0) + shippingCharge

    invoices.push({
      orderNumber: order.orderNumber,
      date: order.createdAt.toISOString(),
      customerName: order.shippingFullName || order.customer?.name || "Customer",
      customerPhone: order.shippingPhone || "—",
      shippingAddress: `${order.shippingAddressLine1}${order.shippingAddressLine2 ? ', ' + order.shippingAddressLine2 : ''}, ${order.shippingCity}, ${order.shippingState} ${order.shippingPostalCode}`,
      seller: {
        storeName: seller?.store?.name || "MEEEM Merchant",
        address: seller?.store?.address || "Registered Merchant Address",
        phone: seller?.store?.phone || "—",
        gstin: seller?.businessInfo?.taxIdNumber || undefined,
        pan: undefined, // Add if available in schema
      },
      items,
      subtotal,
      gstTotal,
      shippingCharge,
      grandTotal,
    })
  }

  return NextResponse.json(invoices)
}
