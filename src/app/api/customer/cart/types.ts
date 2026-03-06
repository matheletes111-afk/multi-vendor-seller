/**
 * Cart API types (request/response) for app/api/customer/cart routes.
 */

export type CartAddProductPayload = {
  productId: string
  productVariantId?: string | null
  quantity: number
}

export type CartAddServicePayload = {
  serviceId: string
  servicePackageId?: string | null
  serviceSlotId?: string | null
  quantity: number
}

export type CartAddPayload = CartAddProductPayload | CartAddServicePayload

export function isProductCartPayload(p: CartAddPayload): p is CartAddProductPayload {
  return "productId" in p && typeof (p as CartAddProductPayload).productId === "string"
}

export type CartPatchPayload = {
  cartItemId: string
  quantity?: number
  remove?: boolean
}

export type GuestCartItemForMerge = {
  productId?: string
  productVariantId?: string
  serviceId?: string
  servicePackageId?: string
  serviceSlotId?: string
  quantity: number
}

export type CartMergePayload = {
  items: GuestCartItemForMerge[]
}

export type CartItemApi = {
  id: string
  productId: string | null
  productVariantId: string | null
  serviceId: string | null
  servicePackageId: string | null
  serviceSlotId: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  hasGst: boolean
  totalGst: number
  totalPriceInclGst: number
  name: string
  image: string | null
}
