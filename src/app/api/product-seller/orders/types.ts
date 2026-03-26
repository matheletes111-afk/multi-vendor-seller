/**
 * Product-seller orders API types for app/api/product-seller/orders.
 */

export type SellerOrderDetailItemApi = {
  id: string
  itemStatus: string
  productNameSnapshot: string | null
  serviceNameSnapshot: string | null
  quantity: number
  price: number
  subtotal: number
  hasGst: boolean
  gstAmount: number
  subtotalInclGst: number | null
  imageUrl: string | null
  returnAvailable: boolean
  replacementAllowed: boolean
  returnResolutionType: "REFUND" | "EXCHANGE" | null
  replacementOrderItemId: string | null
  returnReason: string | null
  returnImages: string[]
  /** Present on the new line created for an exchange (points to original item). */
  exchangeSourceOrderItemId: string | null
  exchangeTopUpAmount: number
  exchangeTopUpStatus: "NOT_REQUIRED" | "PENDING" | "COMPLETED" | null
  exchangeRefundDifferenceAmount: number
  exchangeRefundDifferenceStatus: "NOT_REQUESTED" | "PENDING" | "COMPLETED" | null
  returnRequestStatus: "REQUESTED" | "ACCEPTED" | "REJECTED" | null
  pickupStatus: "NOT_REQUESTED" | "PENDING" | "COMPLETED" | null
  refundStatus: "NOT_REQUESTED" | "PENDING" | "COMPLETED" | null
  deliveryProofImage: string | null
  statusHistory: {
    status: string
    location: string | null
    note: string | null
    createdAt: string
  }[]
}

/** Allowed status values for seller PATCH (no REFUNDED). */
export const SELLER_ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const

export type SellerOrderStatusValue = (typeof SELLER_ORDER_STATUSES)[number]

export type PatchOrderStatusPayload = { status: SellerOrderStatusValue }

export type SellerOrderDetailApi = {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  subtotal: number
  tax: number
  shipping: number
  commission: number
  commissionRate: number
  paymentMethod: string | null
  paymentStatus: string
  shippingFullName: string | null
  shippingPhone: string | null
  shippingAddressLine1: string | null
  shippingAddressLine2: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingPostalCode: string | null
  shippingCountry: string | null
  createdAt: string
  customerName: string | null
  customerEmail: string | null
  items: SellerOrderDetailItemApi[]
}
