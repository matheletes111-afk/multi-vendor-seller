"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import { UserRole } from "@prisma/client"

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

type WishlistContextValue = {
  items: WishlistItem[]
  count: number
  loading: boolean
  canUseWishlist: boolean
  isWishlisted: (productId?: string, serviceId?: string) => boolean
  refreshWishlist: () => Promise<void>
  toggleWishlist: (
    productId?: string,
    serviceId?: string
  ) => Promise<{ action: "added" | "removed" } | { error: string }>
  removeWishlist: (
    productId?: string,
    serviceId?: string
  ) => Promise<{ action: "removed" } | { error: string }>
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const canUseWishlist = status === "authenticated" && session?.user?.role === UserRole.CUSTOMER
  const [items, setItems] = useState<WishlistItem[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const refreshWishlist = useCallback(async () => {
    if (!canUseWishlist) {
      setItems([])
      setCount(0)
      return
    }

    setLoading(true)
    try {
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
  }, [canUseWishlist])

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
      serviceId?: string
    ): Promise<{ action: "added" | "removed" } | { error: string }> => {
      if (!canUseWishlist) return { error: "Only logged-in customers can use wishlist." }
      if (!productId && !serviceId) return { error: "productId or serviceId is required" }
      if (productId && serviceId) return { error: "Cannot add both productId and serviceId" }

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
    [canUseWishlist]
  )

  const removeWishlist = useCallback(
    async (productId?: string, serviceId?: string) => {
      if (!canUseWishlist) return { error: "Only logged-in customers can use wishlist." }
      if (!productId && !serviceId) return { error: "productId or serviceId is required" }

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
    [canUseWishlist]
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

