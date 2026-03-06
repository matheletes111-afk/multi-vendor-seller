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
  name: string
  price: number
  image: string | null
  quantity: number
  /** From API: GST amount for this line. */
  gstAmount?: number
  /** From API: whether this line has GST. */
  hasGst?: boolean
  /** From API: subtotal + GST for this line. */
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
  return item.serviceId ?? ""
}

export function getCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is CartItem =>
        x &&
        typeof x === "object" &&
        typeof x.name === "string" &&
        typeof x.price === "number" &&
        typeof x.quantity === "number" &&
        (typeof (x as CartItem).productId === "string" || typeof (x as CartItem).serviceId === "string")
    )
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
