import type { WishlistItem } from "./wishlist-context"

const GUEST_WISHLIST_KEY = "meeem_guest_wishlist"

export function getGuestWishlistFromStorage(): WishlistItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function setGuestWishlistInStorage(items: WishlistItem[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(items))
  } catch {}
}

export function clearGuestWishlistFromStorage(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(GUEST_WISHLIST_KEY)
  } catch {}
}
