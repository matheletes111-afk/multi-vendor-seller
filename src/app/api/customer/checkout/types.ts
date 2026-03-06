/**
 * Checkout API types (addresses, place order) for app/api/customer/checkout.
 */

export type AddressApi = {
  id: string
  fullName: string
  phone: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  postalCode: string
  country: string
  isDefault: boolean
}

export type PlaceOrderPayload = {
  addressId: string
}

export type PlaceOrderOrderSummary = {
  orderId: string
  orderNumber: string
  sellerId: string
  totalAmount: number
  itemCount: number
}

export type PlaceOrderResponse = {
  success: true
  orderIds: string[]
  orders: PlaceOrderOrderSummary[]
}
