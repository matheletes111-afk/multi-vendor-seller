/**
 * Admin orders API types for app/api/admin/orders.
 */

export const ADMIN_ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const

export type AdminOrderStatusValue = (typeof ADMIN_ORDER_STATUSES)[number]

export type PatchOrderStatusPayload = {
  status: AdminOrderStatusValue
  deliveryProofImage?: string
  location?: string
  note?: string
  otp?: string
}

export type AdminOrderItemStatusHistoryApi = {
  status: string
  location: string | null
  note: string | null
  createdAt: string
}

export type AdminOrderDetailItemApi = {
  id: string
  sellerId: string | null
  sellerStoreName: string | null
  sellerName: string | null
  sellerEmail: string | null
  sellerPhone: string | null
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
  /** Service slot (for service orders). ISO date-time strings. */
  serviceSlotStartTime: string | null
  serviceSlotEndTime: string | null
  shippingAmount: number
  commissionAmount: number
  commissionRateSnapshot: number
  /** Proof image URL when delivered */
  deliveryProofImage: string | null
  deliveredAt: string | null
  deliveryOtp: string | null
  deliveryOtpExpires: string | null
  statusHistory: AdminOrderItemStatusHistoryApi[]
  returnAvailable: boolean
  replacementAllowed: boolean
  /** REFUND vs EXCHANGE when a return exists. */
  returnResolutionType: "REFUND" | "EXCHANGE" | null
  returnReason: string | null
  returnImages: string[]
  /** Exchange replacement line id on this order, if any. */
  replacementOrderItemId: string | null
  /** Set on the new line when it is an exchange shipment. */
  exchangeSourceOrderItemId: string | null
  exchangeTopUpAmount: number
  exchangeTopUpStatus: "NOT_REQUIRED" | "PENDING" | "COMPLETED" | null
  exchangeRefundDifferenceAmount: number
  exchangeRefundDifferenceStatus: "NOT_REQUESTED" | "PENDING" | "COMPLETED" | null
  returnRequestStatus: string | null
  pickupStatus: string | null
  refundStatus: string | null
}

export type AdminOrderSellerGroupApi = {
  sellerId: string | null
  sellerStoreName: string | null
  summary: {
    subtotal: number
    tax: number
    shipping: number
    commission: number
    total: number
  }
  itemStatuses: Record<string, number>
  derivedStatus: string
  itemCount: number
}

export type AdminOrderListItemApi = {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  commission: number
  commissionRate: number
  paymentMethod: string | null
  paymentStatus: string
  createdAt: string
  customerName: string | null
  customerEmail: string | null
  sellerStoreName: string | null
  itemCount: number
  items: {
    id: string
    productName: string | null
    serviceName: string | null
    quantity: number
    price: number
    status: string
    imageUrl: string | null
  }[]
}

export type AdminOrderDetailApi = {
  id: string
  orderNumber: string
  /** True if any line on the order is delivered (cancelling any line is blocked). */
  orderHasDeliveredLine: boolean
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
  customerPhone: string | null
  customerPhoneCountryCode: string | null
  sellerStoreName: string | null
  sellerGroups: AdminOrderSellerGroupApi[]
  items: AdminOrderDetailItemApi[]
  couponCode?: string | null
  couponDiscount?: number | null
}
