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

export type PatchOrderStatusPayload = { status: AdminOrderStatusValue }

export type AdminOrderDetailItemApi = {
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
  items: AdminOrderDetailItemApi[]
}
