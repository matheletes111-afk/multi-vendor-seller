import QRCode from "qrcode"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { deriveOrderStatus } from "@/lib/order-status"
import { resolveOrderDeliveryRegionMeta } from "@/lib/ai-region-matcher"
import { getFloatPaymentTypeFromLink } from "@/components/payments/float-payment-options"
import { createInvoiceQrToken, resolveAppBaseUrl } from "@/lib/invoice-qr"
import { toPublicMediaUrl } from "@/lib/media-url"
import type { InvoiceData, InvoiceItem, InvoiceQrPayload } from "@/lib/invoice-types"

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—"
  const clean = phone.trim()
  if (!clean) return "—"
  if (clean.length <= 4) return clean
  return clean.slice(0, 3) + "****" + clean.slice(-3)
}

function formatPaymentMethodLabel(
  paymentMethod?: string | null,
  flotPaymentLink?: string | null
): string {
  if (!paymentMethod) return "Cash on Delivery"
  const upper = paymentMethod.toUpperCase()
  if (upper === "FLOAT") {
    const sub = getFloatPaymentTypeFromLink(flotPaymentLink)
    if (sub === "in-app") return "Float (Flot App)"
    if (sub === "momo") return "Float (Mobile Money)"
    if (sub === "card") return "Float (Bank Card)"
    return "Float (Online / MoMo / Card)"
  }
  if (upper === "AFRIMONEY") return "AfriMoney Mobile Money"
  if (upper === "STRIPE") return "Card (Stripe)"
  if (upper === "COD") return "Cash on Delivery"
  return paymentMethod
}

function joinAddressParts(parts: Array<string | null | undefined>): string {
  const seen = new Set<string>()
  const cleaned: string[] = []
  for (const part of parts) {
    if (typeof part !== "string") continue
    const trimmed = part.trim()
    if (!trimmed) continue
    const lower = trimmed.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    cleaned.push(trimmed)
  }
  return cleaned.join(", ")
}

function formatSellerAddress(seller: any): string {
  const store = seller?.store
  const bi = seller?.businessInfo
  const fromStore = joinAddressParts([
    store?.address,
    store?.city,
    store?.state,
    store?.zipCode,
    store?.country,
  ])
  if (fromStore) return fromStore

  const fromBi = joinAddressParts([
    bi?.street,
    bi?.city,
    bi?.district,
    bi?.postalCode,
  ])
  if (fromBi) return fromBi

  return "Registered Merchant Address"
}

export const INVOICE_ORDER_INCLUDE = {
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      phoneCountryCode: true,
    },
  },
  seller: {
    include: {
      store: true,
      businessInfo: true,
    },
  },
  items: {
    include: {
      seller: {
        include: {
          store: true,
          businessInfo: true,
        },
      },
      product: { select: { id: true, name: true } },
      productVariant: { select: { id: true, name: true, sku: true } },
      service: { select: { id: true, name: true } },
      servicePackage: { select: { id: true, name: true } },
      serviceSlot: { select: { startTime: true, endTime: true } },
      returnRequest: {
        select: {
          status: true,
          resolutionType: true,
          replacementOrderItemId: true,
          exchangeTopUpAmount: true,
          exchangeTopUpStatus: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const

export type InvoiceOrderRecord = Prisma.OrderGetPayload<{
  include: typeof INVOICE_ORDER_INCLUDE
}>

export interface BuildInvoicesOptions {
  allowedSellerId?: string | null
  filterSellerId?: string | null
  baseUrl?: string | null
  pdfBasePath?: string
  includeQrDataUrl?: boolean
}

/**
 * Formats an Order DB record into per-seller InvoiceData[] with full delivery,
 * region/zone, tax, coupon, payment, and signed QR verification metadata.
 */
export async function formatOrderToInvoices(
  order: InvoiceOrderRecord,
  options: BuildInvoicesOptions = {}
): Promise<InvoiceData[]> {
  const {
    allowedSellerId = null,
    filterSellerId = null,
    baseUrl,
    pdfBasePath = `/api/orders/${order.id}/invoice/pdf`,
    includeQrDataUrl = true,
  } = options

  const resolvedBaseUrl = resolveAppBaseUrl(baseUrl)

  // Compute shipping fallback allocation if legacy order had order.shipping > 0 but 0 on all items
  const totalStoredItemShipping = order.items.reduce((s, it) => s + (it.shippingAmount || 0), 0)
  const fallbackItemShippingMap = new Map<string, number>()

  if (totalStoredItemShipping <= 0 && order.shipping > 0 && order.items.length > 0) {
    const physicalItems = order.items.filter((it) => it.productId != null)
    const targetItems = physicalItems.length > 0 ? physicalItems : order.items
    const targetSubtotal = targetItems.reduce((s, it) => s + (it.subtotal || 0), 0)
    let runningSum = 0

    targetItems.forEach((it, idx) => {
      if (idx === targetItems.length - 1) {
        fallbackItemShippingMap.set(it.id, round2(Math.max(0, order.shipping - runningSum)))
      } else {
        const share =
          targetSubtotal > 0
            ? round2((it.subtotal / targetSubtotal) * order.shipping)
            : round2(order.shipping / targetItems.length)
        fallbackItemShippingMap.set(it.id, share)
        runningSum = round2(runningSum + share)
      }
    })
  }

  // Group ALL order items by seller first to know total group count for proportional allocations
  const allSellerIdsInOrder = new Set<string>()
  for (const item of order.items) {
    allSellerIdsInOrder.add(item.sellerId || order.sellerId || "unknown")
  }
  const totalSellerCountInOrder = allSellerIdsInOrder.size

  const sellerGroups = new Map<
    string,
    {
      sellerId: string | null
      seller: any
      items: InvoiceOrderRecord["items"]
    }
  >()

  for (const item of order.items) {
    const effectiveSellerId = item.sellerId || order.sellerId || null
    if (allowedSellerId && effectiveSellerId !== allowedSellerId) continue
    if (filterSellerId && effectiveSellerId !== filterSellerId) continue

    const key = effectiveSellerId || "unknown"
    if (!sellerGroups.has(key)) {
      sellerGroups.set(key, {
        sellerId: effectiveSellerId,
        seller: item.seller ?? order.seller ?? null,
        items: [],
      })
    }
    sellerGroups.get(key)!.items.push(item)
  }

  // Resolve Delivery Region & Zone from shipping address
  const { deliveryRegion, deliveryZone, deliveryZoneLabel } = resolveOrderDeliveryRegionMeta({
    addressLine1: order.shippingAddressLine1,
    addressLine2: order.shippingAddressLine2,
    city: order.shippingCity,
    state: order.shippingState,
    postalCode: order.shippingPostalCode,
  })

  const formattedShippingAddress =
    joinAddressParts([
      order.shippingAddressLine1,
      order.shippingAddressLine2,
      order.shippingCity,
      order.shippingState,
      order.shippingPostalCode,
      order.shippingCountry,
    ]) || "—"

  const customerName = order.shippingFullName || order.customer?.name || "Customer"
  const customerPhone = order.shippingPhone || order.customer?.phone || "—"
  const customerEmail = order.customer?.email ?? null
  const paymentMethodLabel = formatPaymentMethodLabel(order.paymentMethod, order.flotPaymentLink)

  const invoices: InvoiceData[] = []
  let groupIndex = 0

  for (const group of sellerGroups.values()) {
    groupIndex += 1
    const seller = group.seller
    const isMultiSellerOrder = totalSellerCountInOrder > 1
    const invoiceNumber = isMultiSellerOrder
      ? `INV-${order.orderNumber}-${groupIndex}`
      : `INV-${order.orderNumber}`

    const hasProducts = group.items.some((it) => it.productId != null)
    const hasServices = group.items.some((it) => it.serviceId != null)
    const orderType: "PRODUCT" | "SERVICE" | "MIXED" =
      hasProducts && hasServices ? "MIXED" : hasServices ? "SERVICE" : "PRODUCT"
    const isServiceOnly = !hasProducts && hasServices

    const invoiceItems: InvoiceItem[] = group.items.map((it) => {
      const itemShipping =
        totalStoredItemShipping > 0
          ? round2(it.shippingAmount || 0)
          : fallbackItemShippingMap.get(it.id) ?? 0

      const computedGstRate =
        it.hasGst && it.subtotal > 0
          ? Math.round((it.gstAmount / it.subtotal) * 100)
          : it.hasGst
            ? 15
            : 0

      const itemSubtotal = round2(it.subtotal ?? it.price * it.quantity)
      const itemGst = round2(it.gstAmount ?? 0)
      const itemTotal = round2(it.subtotalInclGst ?? itemSubtotal + itemGst)

      return {
        id: it.id,
        productId: it.productId,
        serviceId: it.serviceId,
        productName: it.productNameSnapshot || it.serviceNameSnapshot || "Item",
        variantName: it.productVariant?.name ?? it.servicePackage?.name ?? null,
        sku: it.productVariant?.sku ?? null,
        itemStatus: it.itemStatus,
        quantity: it.quantity,
        price: round2(it.price),
        subtotal: itemSubtotal,
        hasGst: it.hasGst,
        gstRate: computedGstRate,
        gstAmount: itemGst,
        shippingAmount: itemShipping,
        total: itemTotal,
        serviceSlotStartTime: it.serviceSlot?.startTime ? it.serviceSlot.startTime.toISOString() : null,
        serviceSlotEndTime: it.serviceSlot?.endTime ? it.serviceSlot.endTime.toISOString() : null,
        isExchangeReplacement: Boolean(it.exchangeSourceOrderItemId),
      }
    })

    // Avoid double-counting exchange replacement items in totals
    const replacementItems = invoiceItems.filter((it) => it.isExchangeReplacement)
    const billableItems =
      replacementItems.length > 0
        ? invoiceItems.filter((it) => !it.isExchangeReplacement)
        : invoiceItems

    const subtotal = round2(billableItems.reduce((sum, it) => sum + it.subtotal, 0))
    const gstTotal = round2(billableItems.reduce((sum, it) => sum + it.gstAmount, 0))
    const itemGrossTotal = round2(subtotal + gstTotal)

    let shippingCharge = round2(
      billableItems.reduce((sum, it) => sum + (it.shippingAmount || 0), 0)
    )
    if (!isMultiSellerOrder && order.shipping > 0 && shippingCharge === 0) {
      shippingCharge = round2(order.shipping)
    }
    const isFreeDelivery = !isServiceOnly && shippingCharge <= 0

    let exchangeTopUpAmount = 0
    if (replacementItems.length > 0) {
      const replacementSourceIds = new Set(
        group.items
          .map((it) => it.exchangeSourceOrderItemId)
          .filter((id): id is string => Boolean(id))
      )
      for (const orig of group.items) {
        if (replacementSourceIds.has(orig.id) && orig.returnRequest?.exchangeTopUpAmount) {
          exchangeTopUpAmount = round2(
            exchangeTopUpAmount + orig.returnRequest.exchangeTopUpAmount
          )
        }
      }
    }

    let groupCouponDiscount = 0
    if (order.couponDiscount && order.couponDiscount > 0) {
      if (!isMultiSellerOrder) {
        groupCouponDiscount = round2(order.couponDiscount)
      } else if (order.subtotal > 0) {
        groupCouponDiscount = round2((order.couponDiscount * subtotal) / order.subtotal)
      }
    }

    const grandTotal = round2(
      Math.max(0, itemGrossTotal + shippingCharge + exchangeTopUpAmount - groupCouponDiscount)
    )

    const orderStatus = deriveOrderStatus(group.items.map((it) => it.itemStatus))
    const storeName =
      seller?.store?.name || seller?.businessInfo?.businessName || "MEEEM Merchant"

    const qrToken = createInvoiceQrToken({
      orderId: order.id,
      orderNumber: order.orderNumber,
      sellerId: group.sellerId,
    })
    const qrVerifyUrl = `${resolvedBaseUrl}/invoice/verify?t=${encodeURIComponent(qrToken)}`

    const itemsSummary = invoiceItems
      .map((it) => `${it.productName} (x${it.quantity})`)
      .join(", ")

    const qrPayload: InvoiceQrPayload = {
      version: 1,
      invoiceNumber,
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus,
      date: order.createdAt.toISOString(),
      storeName,
      sellerId: group.sellerId,
      customerName,
      deliveryRegion,
      deliveryZone,
      deliveryZoneLabel,
      subtotal,
      gstTotal,
      shippingCharge,
      isFreeDelivery,
      couponDiscount: groupCouponDiscount,
      grandTotal,
      currency: "NLe",
      paymentMethod: order.paymentMethod ?? null,
      paymentStatus: order.paymentStatus ?? null,
      itemsCount: invoiceItems.length,
      itemsSummary,
      verifyUrl: qrVerifyUrl,
    }

    let qrDataUrl: string | undefined
    if (includeQrDataUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(qrVerifyUrl, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0f172a", light: "#ffffff" },
        })
      } catch {
        qrDataUrl = undefined
      }
    }

    const sellerParam = group.sellerId ? `?sellerId=${encodeURIComponent(group.sellerId)}` : ""

    invoices.push({
      invoiceNumber,
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus,
      orderType,
      isServiceOnly,
      date: order.createdAt.toISOString(),
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress: formattedShippingAddress,
      shippingAddressDetails: {
        fullName: customerName,
        phone: customerPhone,
        addressLine1: order.shippingAddressLine1 ?? null,
        addressLine2: order.shippingAddressLine2 ?? null,
        city: order.shippingCity ?? null,
        state: order.shippingState ?? null,
        postalCode: order.shippingPostalCode ?? null,
        country: order.shippingCountry ?? null,
        latitude: order.shippingLatitude ?? null,
        longitude: order.shippingLongitude ?? null,
      },
      deliveryRegion,
      deliveryZone,
      deliveryZoneLabel,
      seller: {
        sellerId: group.sellerId,
        storeName,
        businessName: seller?.businessInfo?.businessName ?? null,
        address: formatSellerAddress(seller),
        phone: seller?.store?.phone || "—",
        logo: toPublicMediaUrl(seller?.store?.logo ?? null, resolvedBaseUrl),
        gstin: seller?.businessInfo?.taxIdNumber || undefined,
        regNumber: seller?.businessInfo?.businessRegNumber || undefined,
        pan: undefined,
        isSelfDelivery: group.items.some((i) => Boolean(i.isSelfDelivery)),
      },
      items: invoiceItems,
      subtotal,
      gstTotal,
      itemGrossTotal,
      shippingCharge,
      isFreeDelivery,
      exchangeTopUpAmount: exchangeTopUpAmount > 0 ? exchangeTopUpAmount : undefined,
      grandTotal,
      currency: "NLe",
      couponCode: order.couponCode ?? null,
      couponDiscount: groupCouponDiscount,
      paymentMethod: order.paymentMethod ?? null,
      paymentMethodLabel,
      paymentStatus: order.paymentStatus ?? null,
      afriTxnId: order.afriTxnId ?? null,
      flotOrderId: order.flotOrderId ?? null,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      qrToken,
      qrVerifyUrl,
      qrDataUrl,
      qrPayload,
      pdfDownloadUrl: `${pdfBasePath}${sellerParam}`,
    })
  }

  return invoices
}

/**
 * Fetches an order by ID and transforms it into formatted InvoiceData[].
 */
export async function buildOrderInvoices(
  orderId: string,
  options: BuildInvoicesOptions = {}
): Promise<{ order: InvoiceOrderRecord; invoices: InvoiceData[] } | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: INVOICE_ORDER_INCLUDE,
  })
  if (!order) return null

  const invoices = await formatOrderToInvoices(order, options)
  return { order, invoices }
}

/**
 * Masks sensitive customer PII for unauthenticated public QR scans while keeping all
 * invoice verification data (items, totals, delivery charge, delivery region/zone, seller, status).
 */
export function sanitizeInvoicesForPublicQr(invoices: InvoiceData[]): InvoiceData[] {
  return invoices.map((inv) => {
    const maskedPhone = maskPhone(inv.customerPhone)
    const publicAddr =
      joinAddressParts([
        inv.shippingAddressDetails.city,
        inv.shippingAddressDetails.state,
        inv.shippingAddressDetails.country,
      ]) || inv.deliveryZoneLabel

    return {
      ...inv,
      customerPhone: maskedPhone,
      customerEmail: null,
      shippingAddress: publicAddr,
      shippingAddressDetails: {
        ...inv.shippingAddressDetails,
        phone: maskedPhone,
        addressLine1: null,
        addressLine2: null,
        latitude: null,
        longitude: null,
      },
      pdfDownloadUrl: undefined,
    }
  })
}
