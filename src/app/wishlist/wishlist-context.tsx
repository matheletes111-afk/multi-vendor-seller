"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import { UserRole } from "@prisma/client"
import {
  getGuestWishlistFromStorage,
  setGuestWishlistInStorage,
  clearGuestWishlistFromStorage,
} from "./guest-wishlist"

type WishlistProduct = {
  id: string
  name: string
  slug: string
  image: string | null
  price: number | null
}

type WishlistService = {
  id: string
  name: string
  slug: string
  image: string | null
  price: number | null
}

export type WishlistItem = {
  wishlistItemId: string
  productId: string | null
  serviceId: string | null
  createdAt: string
  product: WishlistProduct | null
  service: WishlistService | null
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
}

type WishlistContextValue = {
  items: WishlistItem[]
  count: number
  loading: boolean
  canUseWishlist: boolean
  isWishlisted: (productId?: string, serviceId?: string) => boolean
  refreshWishlist: () => Promise<void>
  toggleWishlist: (
    productId?: string,
    serviceId?: string,
    details?: WishlistMeta
  ) => Promise<{ action: "added" | "removed" } | { error: string }>
  removeWishlist: (
    productId?: string,
    serviceId?: string
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
          for (const gItem of guestItems) {
            if (gItem.productId || gItem.serviceId) {
              await fetch("/api/customer/wishlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ productId: gItem.productId, serviceId: gItem.serviceId }),
              }).catch(() => {})
            }
          }
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

  const isWishlisted = useCallback(
    (productId?: string, serviceId?: string) => {
      if (productId) {
        return items.some((item) => item.productId === productId && item.serviceId == null)
      }
      if (serviceId) {
        return items.some((item) => item.serviceId === serviceId && item.productId == null)
      }
      return false
    },
    [items]
  )

  const toggleWishlist = useCallback(
    async (
      productId?: string,
      serviceId?: string,
      details?: WishlistMeta
    ): Promise<{ action: "added" | "removed" } | { error: string }> => {
      if (!canUseWishlist) return { error: "Wishlist is only available for shoppers and guests." }
      if (!productId && !serviceId) return { error: "productId or serviceId is required" }
      if (productId && serviceId) return { error: "Cannot add both productId and serviceId" }

      if (isGuest) {
        const currentGuestItems = getGuestWishlistFromStorage()
        const matchesTarget = (item: WishlistItem) =>
          productId
            ? item.productId === productId && item.serviceId == null
            : item.serviceId === serviceId && item.productId == null

        const existing = currentGuestItems.find(matchesTarget)
        if (existing) {
          const nextGuest = currentGuestItems.filter((i) => !matchesTarget(i))
          setGuestWishlistInStorage(nextGuest)
          setItems(nextGuest)
          setCount(nextGuest.length)
          return { action: "removed" }
        } else {
          const newItem: WishlistItem = {
            wishlistItemId: `guest-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            productId: productId ?? null,
            serviceId: serviceId ?? null,
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
          body: JSON.stringify({ productId, serviceId }),
        })
        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { error?: string }
          return { error: errorData.error ?? "Could not update wishlist." }
        }

        const data = (await response.json()) as ToggleResponse
        const action = data.action === "removed" ? "removed" : "added"

        setItems((prev) => {
          const matchesTarget = (item: WishlistItem) =>
            productId
              ? item.productId === productId && item.serviceId == null
              : item.serviceId === serviceId && item.productId == null
          if (action === "removed") {
            return prev.filter((item) => !matchesTarget(item))
          }
          if (!data.item) return prev
          const withoutExisting = prev.filter((item) => !matchesTarget(item))
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
    async (productId?: string, serviceId?: string) => {
      if (!canUseWishlist) return { error: "Wishlist is only available for shoppers and guests." }
      if (!productId && !serviceId) return { error: "productId or serviceId is required" }

      if (isGuest) {
        const currentGuestItems = getGuestWishlistFromStorage()
        const matchesTarget = (item: WishlistItem) =>
          productId
            ? item.productId === productId && item.serviceId == null
            : item.serviceId === serviceId && item.productId == null
        const nextGuest = currentGuestItems.filter((i) => !matchesTarget(i))
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
          body: JSON.stringify({ productId, serviceId }),
        })
        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { error?: string }
          return { error: errorData.error ?? "Could not remove from wishlist." }
        }
        const data = (await response.json()) as ToggleResponse
        setItems((prev) =>
          prev.filter((item) =>
            productId
              ? !(item.productId === productId && item.serviceId == null)
              : !(item.serviceId === serviceId && item.productId == null)
          )
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
