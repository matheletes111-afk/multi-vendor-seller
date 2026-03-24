/**
 * Admin orders API types for app/api/admin/orders.
 */

export const ADMIN_ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const

export type AdminOrderStatusValue = (typeof ADMIN_ORDER_STATUSES)[number]

export type PatchOrderStatusPayload = {
  status: AdminOrderStatusValue
  /** Per-item update: delivery proof URL (S3) when status is DELIVERED */
  deliveryProofImage?: string
  location?: string
  note?: string
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
  statusHistory: AdminOrderItemStatusHistoryApi[]
  returnAvailable: boolean
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
}

export type AdminOrderDetailApi = {
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
  sellerStoreName: string | null
  sellerGroups: AdminOrderSellerGroupApi[]
  items: AdminOrderDetailItemApi[]
}
