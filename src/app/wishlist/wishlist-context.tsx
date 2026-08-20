"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import { UserRole } from "@prisma/client"
import {
  getGuestWishlistFromStorage,
  setGuestWishlistInStorage,
  clearGuestWishlistFromStorage,
} from "./guest-wishlist"

export type WishlistProduct = {
  id: string
  name: string
  slug: string
  image: string | null
  price: number | null
}

export type WishlistService = {
  id: string
  name: string
  slug: string
  image: string | null
  price: number | null
}

export type WishlistHotel = {
  id: string
  name: string
  slug?: string
  image: string | null
  price: number | null
  city?: string | null
  starRating?: number
}

export type WishlistFoodItem = {
  id: string
  name: string
  image: string | null
  price: number | null
  isVeg?: boolean
  category?: string
  restaurantName?: string
}

export type WishlistItem = {
  wishlistItemId: string
  productId: string | null
  serviceId: string | null
  hotelId: string | null
  foodItemId: string | null
  createdAt: string
  product: WishlistProduct | null
  service: WishlistService | null
  hotel: WishlistHotel | null
  foodItem: WishlistFoodItem | null
}

type WishlistResponse = {
  items?: WishlistItem[]
  count?: number
}

type ToggleResponse = {
  ok?: boolean
  action?: "added" | "removed"
  count?: number
  item?: WishlistItem | null
}

export type WishlistMeta = {
  name?: string
  image?: string | null
  price?: number | null
  city?: string | null
  starRating?: number
  isVeg?: boolean
  category?: string
  restaurantName?: string
}

type WishlistContextValue = {
  items: WishlistItem[]
  count: number
  loading: boolean
  canUseWishlist: boolean
  isWishlisted: (
    productId?: string,
    serviceId?: string,
    hotelId?: string,
    foodItemId?: string
  ) => boolean
  refreshWishlist: () => Promise<void>
  toggleWishlist: (
    productId?: string,
    serviceId?: string,
    hotelId?: string,
    foodItemId?: string,
    details?: WishlistMeta
  ) => Promise<{ action: "added" | "removed" } | { error: string }>
  removeWishlist: (
    productId?: string,
    serviceId?: string,
    hotelId?: string,
    foodItemId?: string
  ) => Promise<{ action: "removed" } | { error: string }>
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const isCustomer = session?.user?.role === UserRole.CUSTOMER
  const isGuest = status === "unauthenticated"
  const canUseWishlist = isGuest || (status === "authenticated" && isCustomer)
  const isWishlistFromApi = status === "authenticated" && isCustomer

  const [items, setItems] = useState<WishlistItem[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const refreshWishlist = useCallback(async () => {
    if (!canUseWishlist) {
      setItems([])
      setCount(0)
      return
    }

    if (isGuest) {
      const guestItems = getGuestWishlistFromStorage()
      setItems(guestItems)
      setCount(guestItems.length)
      return
    }

    if (isWishlistFromApi) {
      setLoading(true)
      try {
        // Sync guest items if any were stored before customer login
        const guestItems = getGuestWishlistFromStorage()
        if (guestItems.length > 0) {
          const syncPayload = guestItems.map((g) => ({
            productId: g.productId ?? undefined,
            serviceId: g.serviceId ?? undefined,
            hotelId: g.hotelId ?? undefined,
            foodItemId: g.foodItemId ?? undefined,
          }))

          await fetch("/api/customer/wishlist/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ items: syncPayload }),
          }).catch(async () => {
            // Fallback: single POST calls
            for (const gItem of guestItems) {
              await fetch("/api/customer/wishlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  productId: gItem.productId,
                  serviceId: gItem.serviceId,
                  hotelId: gItem.hotelId,
                  foodItemId: gItem.foodItemId,
                }),
              }).catch(() => {})
            }
          })
          clearGuestWishlistFromStorage()
        }

        const response = await fetch("/api/customer/wishlist", { credentials: "include" })
        if (!response.ok) {
          setItems([])
          setCount(0)
          return
        }
        const data = (await response.json()) as WishlistResponse
        const nextItems = Array.isArray(data.items) ? data.items : []
        setItems(nextItems)
        setCount(typeof data.count === "number" ? data.count : nextItems.length)
      } catch {
        setItems([])
        setCount(0)
      } finally {
        setLoading(false)
      }
    }
  }, [canUseWishlist, isGuest, isWishlistFromApi])

  useEffect(() => {
    void refreshWishlist()
  }, [refreshWishlist])

  const matchesItem = (
    item: WishlistItem,
    productId?: string,
    serviceId?: string,
    hotelId?: string,
    foodItemId?: string
  ) => {
    if (productId) return item.productId === productId
    if (serviceId) return item.serviceId === serviceId
    if (hotelId) return item.hotelId === hotelId
    if (foodItemId) return item.foodItemId === foodItemId
    return false
  }

  const isWishlisted = useCallback(
    (productId?: string, serviceId?: string, hotelId?: string, foodItemId?: string) => {
      if (!productId && !serviceId && !hotelId && !foodItemId) return false
      return items.some((item) => matchesItem(item, productId, serviceId, hotelId, foodItemId))
    },
    [items]
  )

  const toggleWishlist = useCallback(
    async (
      productId?: string,
      serviceId?: string,
      hotelId?: string,
      foodItemId?: string,
      details?: WishlistMeta
    ): Promise<{ action: "added" | "removed" } | { error: string }> => {
      if (!canUseWishlist) return { error: "Wishlist is only available for shoppers and guests." }
      const idsCount = [productId, serviceId, hotelId, foodItemId].filter(Boolean).length
      if (idsCount === 0) return { error: "Target ID (productId, serviceId, hotelId, or foodItemId) is required" }
      if (idsCount > 1) return { error: "Cannot specify multiple target IDs in one request" }

      if (isGuest) {
        const currentGuestItems = getGuestWishlistFromStorage()
        const existing = currentGuestItems.find((i) =>
          matchesItem(i, productId, serviceId, hotelId, foodItemId)
        )
        if (existing) {
          const nextGuest = currentGuestItems.filter(
            (i) => !matchesItem(i, productId, serviceId, hotelId, foodItemId)
          )
          setGuestWishlistInStorage(nextGuest)
          setItems(nextGuest)
          setCount(nextGuest.length)
          return { action: "removed" }
        } else {
          const newItem: WishlistItem = {
            wishlistItemId: `guest-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            productId: productId ?? null,
            serviceId: serviceId ?? null,
            hotelId: hotelId ?? null,
            foodItemId: foodItemId ?? null,
            createdAt: new Date().toISOString(),
            product: productId
              ? {
                  id: productId,
                  name: details?.name || "Product",
                  slug: "",
                  image: details?.image ?? null,
                  price: details?.price ?? null,
                }
              : null,
            service: serviceId
              ? {
                  id: serviceId,
                  name: details?.name || "Service",
                  slug: "",
                  image: details?.image ?? null,
                  price: details?.price ?? null,
                }
              : null,
            hotel: hotelId
              ? {
                  id: hotelId,
                  name: details?.name || "Hotel",
                  slug: "",
                  image: details?.image ?? null,
                  price: details?.price ?? null,
                  city: details?.city ?? null,
                  starRating: details?.starRating ?? 0,
                }
              : null,
            foodItem: foodItemId
              ? {
                  id: foodItemId,
                  name: details?.name || "Food Item",
                  image: details?.image ?? null,
                  price: details?.price ?? null,
                  isVeg: details?.isVeg ?? true,
                  category: details?.category,
                  restaurantName: details?.restaurantName,
                }
              : null,
          }
          const nextGuest = [newItem, ...currentGuestItems]
          setGuestWishlistInStorage(nextGuest)
          setItems(nextGuest)
          setCount(nextGuest.length)
          return { action: "added" }
        }
      }

      setLoading(true)
      try {
        const response = await fetch("/api/customer/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ productId, serviceId, hotelId, foodItemId }),
        })
        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { error?: string }
          return { error: errorData.error ?? "Could not update wishlist." }
        }

        const data = (await response.json()) as ToggleResponse
        const action = data.action === "removed" ? "removed" : "added"

        setItems((prev) => {
          if (action === "removed") {
            return prev.filter((item) => !matchesItem(item, productId, serviceId, hotelId, foodItemId))
          }
          if (!data.item) return prev
          const withoutExisting = prev.filter(
            (item) => !matchesItem(item, productId, serviceId, hotelId, foodItemId)
          )
          return [data.item, ...withoutExisting]
        })
        if (typeof data.count === "number") {
          setCount(data.count)
        } else {
          setCount((prev) => (action === "added" ? prev + 1 : Math.max(0, prev - 1)))
        }
        return { action }
      } catch {
        return { error: "Could not update wishlist." }
      } finally {
        setLoading(false)
      }
    },
    [canUseWishlist, isGuest]
  )

  const removeWishlist = useCallback(
    async (productId?: string, serviceId?: string, hotelId?: string, foodItemId?: string) => {
      if (!canUseWishlist) return { error: "Wishlist is only available for shoppers and guests." }
      const idsCount = [productId, serviceId, hotelId, foodItemId].filter(Boolean).length
      if (idsCount === 0) return { error: "Target ID is required" }

      if (isGuest) {
        const currentGuestItems = getGuestWishlistFromStorage()
        const nextGuest = currentGuestItems.filter(
          (i) => !matchesItem(i, productId, serviceId, hotelId, foodItemId)
        )
        setGuestWishlistInStorage(nextGuest)
        setItems(nextGuest)
        setCount(nextGuest.length)
        return { action: "removed" as const }
      }

      setLoading(true)
      try {
        const response = await fetch("/api/customer/wishlist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ productId, serviceId, hotelId, foodItemId }),
        })
        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { error?: string }
          return { error: errorData.error ?? "Could not remove from wishlist." }
        }
        const data = (await response.json()) as ToggleResponse
        setItems((prev) =>
          prev.filter((item) => !matchesItem(item, productId, serviceId, hotelId, foodItemId))
        )
        if (typeof data.count === "number") setCount(data.count)
        else setCount((prev) => Math.max(0, prev - 1))
        return { action: "removed" as const }
      } catch {
        return { error: "Could not remove from wishlist." }
      } finally {
        setLoading(false)
      }
    },
    [canUseWishlist, isGuest]
  )

  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      count,
      loading,
      canUseWishlist,
      isWishlisted,
      refreshWishlist,
      toggleWishlist,
      removeWishlist,
    }),
    [items, count, loading, canUseWishlist, isWishlisted, refreshWishlist, toggleWishlist, removeWishlist]
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext)
  if (!context) throw new Error("useWishlist must be used within WishlistProvider")
  return context
}
