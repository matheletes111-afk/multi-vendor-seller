const CART_STORAGE_KEY = "meeem-cart"

export type CartItem = {
  productId: string
  name: string
  price: number
  image: string | null
  quantity: number
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
        typeof x.productId === "string" &&
        typeof x.name === "string" &&
        typeof x.price === "number" &&
        typeof x.quantity === "number"
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
