/**
 * Customer orders API types for app/api/customer/orders.
 */

export type OrderDetailItemApi = {
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

export type OrderDetailApi = {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  subtotal: number
  tax: number
  shipping: number
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
  sellerStoreName: string | null
  items: OrderDetailItemApi[]
}
