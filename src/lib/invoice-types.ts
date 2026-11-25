/**
 * Shared invoice types used across Web UI, Web API, Mobile API, QR verification, and A4 PDF generation.
 */

export interface InvoiceItem {
  id: string
  productId?: string | null
  serviceId?: string | null
  productName: string
  variantName?: string | null
  sku?: string | null
  itemStatus?: string
  quantity: number
  price: number
  subtotal: number
  hasGst?: boolean
  gstRate?: number
  gstAmount: number
  shippingAmount: number
  total: number
  serviceSlotStartTime?: string | null
  serviceSlotEndTime?: string | null
  isExchangeReplacement?: boolean
}

export interface InvoiceSeller {
  sellerId?: string | null
  storeName: string
  businessName?: string | null
  address: string
  phone: string
  logo?: string | null
  gstin?: string
  regNumber?: string
  pan?: string
  isSelfDelivery?: boolean
}

export interface InvoiceShippingAddressDetails {
  fullName: string
  phone: string
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface InvoiceQrPayload {
  version: number
  invoiceNumber: string
  orderId: string
  orderNumber: string
  orderStatus: string
  date: string
  storeName: string
  sellerId: string | null
  customerName: string
  deliveryRegion: string
  deliveryZone: string
  deliveryZoneLabel: string
  subtotal: number
  gstTotal: number
  shippingCharge: number
  isFreeDelivery: boolean
  couponDiscount: number
  grandTotal: number
  currency: string
  paymentMethod: string | null
  paymentStatus: string | null
  itemsCount: number
  itemsSummary: string
  verifyUrl: string
}

export interface InvoiceData {
  invoiceNumber: string
  orderId: string
  orderNumber: string
  orderStatus: string
  orderType: "PRODUCT" | "SERVICE" | "MIXED"
  isServiceOnly: boolean
  date: string
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  shippingAddress: string
  shippingAddressDetails: InvoiceShippingAddressDetails
  deliveryRegion: string
  deliveryZone: string
  deliveryZoneLabel: string
  seller: InvoiceSeller
  items: InvoiceItem[]
  subtotal: number
  gstTotal: number
  itemGrossTotal: number
  shippingCharge: number
  isFreeDelivery: boolean
  exchangeTopUpAmount?: number
  grandTotal: number
  currency: string
  couponCode?: string | null
  couponDiscount?: number
  paymentMethod?: string | null
  paymentMethodLabel?: string | null
  paymentStatus?: string | null
  afriTxnId?: string | null
  flotOrderId?: string | null
  paidAt?: string | null
  qrToken: string
  qrVerifyUrl: string
  qrDataUrl?: string
  qrPayload: InvoiceQrPayload
  pdfDownloadUrl?: string
}
