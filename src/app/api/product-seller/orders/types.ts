/**
 * Product-seller orders API types for app/api/product-seller/orders.
 */

export type SellerOrderDetailItemApi = {
  id: string
  productNameSnapshot: string | null
  serviceNameSnapshot: string | null
  quantity: number
  price: number
  subtotal: number
  hasGst: boolean
  gstAmount: number
  subtotalInclGst: number | null
  imageUrl: string | null
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
