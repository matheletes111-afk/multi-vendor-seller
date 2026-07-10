/**
 * Service-seller orders API types for app/api/service-seller/orders.
 */

export const SELLER_ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const

export type SellerOrderStatusValue = (typeof SELLER_ORDER_STATUSES)[number]

/** Line-item statuses service sellers may set (no product shipping steps). */
export const SERVICE_SELLER_LINE_ITEM_STATUS_OPTIONS = [
  "PENDING",
  "CONFIRMED",
  "DELIVERED",
  "CANCELLED",
] as const

export type ServiceSellerLineItemStatusOption = (typeof SERVICE_SELLER_LINE_ITEM_STATUS_OPTIONS)[number]

export type PatchOrderStatusPayload = { status: SellerOrderStatusValue }

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
  /** Service slot (for service orders). ISO date-time strings. */
  serviceSlotStartTime: string | null
  serviceSlotEndTime: string | null
  deliveryProofImage: string | null
  statusHistory: {
    status: string
    location: string | null
    note: string | null
    createdAt: string
  }[]
}

export type SellerOrderDetailApi = {
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
  /** Your net for this order’s service lines: gross − platform commission. */
  sellerNet: number
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
  couponCode?: string | null
  couponDiscount?: number | null
}
