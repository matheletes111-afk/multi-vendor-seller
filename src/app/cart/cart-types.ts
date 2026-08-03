/**
 * Cart types and guest storage helpers for the cart UI (app/cart and header sync).
 */

const CART_STORAGE_KEY = "meeem-cart"

export type CartItem = {
  id?: string
  productId?: string
  productVariantId?: string
  serviceId?: string
  servicePackageId?: string
  serviceSlotId?: string
  /** Guest cart: chosen slot times (ISO); slot created on merge or when customer adds. */
  slotStartTime?: string
  slotEndTime?: string
  name: string
  price: number
  image: string | null
  quantity: number
  gstAmount?: number
  hasGst?: boolean
  lineTotal?: number
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

export function getCartItemId(item: CartItem): string {
  if (item.id) return item.id
  if (item.productId) return item.productVariantId ? `${item.productId}:${item.productVariantId}` : item.productId
  if (item.serviceId) return item.slotStartTime ? `${item.serviceId}:${item.slotStartTime}` : item.serviceSlotId ? `${item.serviceId}:${item.serviceSlotId}` : item.serviceId
  return ""
}

export function getCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const rawItems = parsed.filter(
      (x): x is CartItem =>
        x &&
        typeof x === "object" &&
        typeof x.name === "string" &&
        typeof x.price === "number" &&
        typeof x.quantity === "number" &&
        (typeof (x as CartItem).productId === "string" || typeof (x as CartItem).serviceId === "string")
    )

    // Consolidate duplicate items for the same product/service
    const consolidated: CartItem[] = []
    for (const item of rawItems) {
      if (item.productId) {
        const existing = consolidated.find((c) => {
          if (c.productId !== item.productId) return false
          // If both have variant IDs and they differ, keep separate
          if (c.productVariantId && item.productVariantId && c.productVariantId !== item.productVariantId) {
            return false
          }
          return true
        })
        if (existing) {
          existing.quantity += item.quantity
          if (!existing.productVariantId && item.productVariantId) {
            existing.productVariantId = item.productVariantId
          }
          if (!existing.image && item.image) {
            existing.image = item.image
          }
        } else {
          consolidated.push({ ...item })
        }
      } else {
        consolidated.push({ ...item })
      }
    }

    // Save cleaned cart back if items were merged
    if (consolidated.length < rawItems.length) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(consolidated))
      } catch {
        // ignore
      }
    }

    return consolidated
  } catch {
    return []
  }
}

export function setCartInStorage(items: CartItem[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new Event("meeem-cart-update"))
  } catch {
    // ignore
  }
}
