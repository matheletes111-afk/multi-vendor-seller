"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useSession } from "next-auth/react"
import { UserRole } from "@prisma/client"
import {
  getCartFromStorage,
  setCartInStorage,
  getCartItemId,
  type CartItem,
  type CartItemApi,
} from "./cart-types"

function mapApiItemToCartItem(api: CartItemApi): CartItem {
  return {
    id: api.id,
    productId: api.productId ?? undefined,
    productVariantId: api.productVariantId ?? undefined,
    serviceId: api.serviceId ?? undefined,
    servicePackageId: api.servicePackageId ?? undefined,
    serviceSlotId: api.serviceSlotId ?? undefined,
    name: api.name,
    price: api.unitPrice,
    image: api.image,
    quantity: api.quantity,
    hasGst: api.hasGst,
    gstAmount: api.totalGst,
    lineTotal: api.totalPriceInclGst ?? api.totalPrice + api.totalGst,
  }
}

type CartContextValue = {
  items: CartItem[]
  totalItems: number
  subtotal: number
  addItem: (item: Omit<CartItem, "quantity"> | CartItem) => Promise<{ error: string } | void>
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  refresh: () => void
  isCartFromApi: boolean
  isLoading: boolean
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const isCustomer = session?.user?.role === UserRole.CUSTOMER
  const isCartFromApi = status === "authenticated" && isCustomer
  const [hasLoadedCartFromApi, setHasLoadedCartFromApi] = useState(false)
  const didMergeGuestCartRef = useRef(false)

  const fetchCartFromApi = useCallback(async () => {
    if (!isCustomer) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/customer/cart", { credentials: "include" })
      if (res.ok) {
        const data = (await res.json()) as CartItemApi[]
        setItems(Array.isArray(data) ? data.map(mapApiItemToCartItem) : [])
      } else {
        setItems([])
      }
    } catch {
      setItems([])
    } finally {
      setIsLoading(false)
      setHasLoadedCartFromApi(true)
    }
  }, [isCustomer])

  const refresh = useCallback(() => {
    if (status === "loading") return
    if (isCustomer) {
      void fetchCartFromApi()
    } else {
      setItems([...getCartFromStorage()])
    }
  }, [status, isCustomer, fetchCartFromApi])

  useEffect(() => {
    refresh()
  }, [refresh])

  // One-time merge of guest cart (localStorage) into DB after social login
  // when the user first becomes an authenticated CUSTOMER.
  //
  // Credentials-based login already merges server-side in
  // `/api/customer/auth/login`, so this should be a no-op there.
  useEffect(() => {
    if (!isCustomer) return
    if (didMergeGuestCartRef.current) return
    if (status !== "authenticated") return
    if (!hasLoadedCartFromApi) return

    const guestCart = getCartFromStorage()
    if (!guestCart.length) {
      didMergeGuestCartRef.current = true
      return
    }

    // If DB cart already has items, don't merge again.
    if (items.length > 0) {
      didMergeGuestCartRef.current = true
      return
    }

    const run = async () => {
      try {
        const payloadItems = guestCart.map((i) => ({
          productId: i.productId,
          productVariantId: i.productVariantId ?? undefined,
          serviceId: i.serviceId,
          servicePackageId: i.servicePackageId ?? undefined,
          serviceSlotId: i.serviceSlotId ?? undefined,
          quantity: i.quantity,
        }))

        const res = await fetch("/api/customer/cart/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ items: payloadItems }),
        })

        if (res.ok) {
          setCartInStorage([])
          didMergeGuestCartRef.current = true
          void fetchCartFromApi()
        } else {
          // If merge failed, avoid looping forever; treat as merged to prevent repeats.
          didMergeGuestCartRef.current = true
        }
      } catch {
        didMergeGuestCartRef.current = true
      }
    }

    void run()
  }, [fetchCartFromApi, hasLoadedCartFromApi, isCustomer, items.length, status])

  useEffect(() => {
    if (!isCustomer) {
      const handler = () => setItems([...getCartFromStorage()])
      window.addEventListener("meeem-cart-update", handler)
      return () => window.removeEventListener("meeem-cart-update", handler)
    }
  }, [isCustomer])

  const addItem = useCallback(
    async (input: Omit<CartItem, "quantity"> | CartItem): Promise<{ error: string } | void> => {
      if (input.serviceId) return
      const quantity = "quantity" in input ? input.quantity : 1
      if (isCustomer) {
        if (!input.productId) return
        setIsLoading(true)
        try {
          const body: { productId?: string; productVariantId?: string; quantity: number } = { quantity }
          body.productId = input.productId
          if (input.productVariantId) body.productVariantId = input.productVariantId
          const res = await fetch("/api/customer/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          })
          if (res.ok) {
            const data = (await res.json()) as CartItemApi[]
            setItems(Array.isArray(data) ? data.map(mapApiItemToCartItem) : [])
            return
          }
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          return { error: data.error || "Could not add to cart" }
        } finally {
          setIsLoading(false)
        }
      }
      if (!input.productId) return
      let effectiveVariantId = (input as CartItem).productVariantId
      if (!effectiveVariantId) {
        try {
          const res = await fetch(`/api/products/${input.productId}`)
          if (res.ok) {
            const data = (await res.json()) as { variants?: Array<{ id: string }> }
            const firstVariantId = Array.isArray(data.variants) ? data.variants[0]?.id : undefined
            if (typeof firstVariantId === "string" && firstVariantId.length > 0) {
              effectiveVariantId = firstVariantId
            }
          }
        } catch {
          // keep as undefined when default variant fetch fails
        }
      }
      const next = getCartFromStorage()
      const sameLine = (i: CartItem) =>
        i.productId === input.productId &&
        (effectiveVariantId != null
          ? i.productVariantId === effectiveVariantId
          : i.productVariantId == null)
      const existing = next.find(sameLine)
      if (existing) {
        existing.quantity += quantity
        const existingIndex = next.findIndex((i) => getCartItemId(i) === getCartItemId(existing))
        if (existingIndex > 0) {
          const [line] = next.splice(existingIndex, 1)
          next.unshift(line)
        }
      } else {
        next.unshift({
          productId: input.productId,
          productVariantId: effectiveVariantId,
          name: input.name,
          price: input.price,
          image: input.image ?? null,
          quantity,
        })
      }
      setCartInStorage(next)
      setItems([...next])
      return
    },
    [isCustomer]
  )

  const removeItem = useCallback(
    async (itemId: string) => {
      if (isCustomer) {
        const item = items.find((i) => getCartItemId(i) === itemId)
        if (item?.id) {
          setIsLoading(true)
          try {
            const res = await fetch("/api/customer/cart", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ cartItemId: item.id, remove: true }),
            })
            if (res.ok) {
              const data = (await res.json()) as CartItemApi[]
              setItems(Array.isArray(data) ? data.map(mapApiItemToCartItem) : [])
            }
          } finally {
            setIsLoading(false)
          }
        }
        return
      }
      const next = getCartFromStorage().filter((i) => getCartItemId(i) !== itemId)
      setCartInStorage(next)
      setItems([...next])
    },
    [isCustomer, items]
  )

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (quantity < 1) {
        removeItem(itemId)
        return
      }
      const item = items.find((i) => getCartItemId(i) === itemId)
      if (isCustomer) {
        if (item?.id) {
          setIsLoading(true)
          try {
            const res = await fetch("/api/customer/cart", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ cartItemId: item.id, quantity }),
            })
            if (res.ok) {
              const data = (await res.json()) as CartItemApi[]
              setItems(Array.isArray(data) ? data.map(mapApiItemToCartItem) : [])
            }
          } finally {
            setIsLoading(false)
          }
        }
        return
      }
      const next = getCartFromStorage().map((i) =>
        getCartItemId(i) === itemId ? { ...i, quantity } : i
      )
      setCartInStorage(next)
      setItems([...next])
    },
    [isCustomer, items, removeItem]
  )

  const productItems = items.filter((i) => i.productId)
  const totalItems = productItems.reduce((n, i) => n + i.quantity, 0)
  const subtotal = productItems.reduce((s, i) => s + i.price * i.quantity, 0)

  const value: CartContextValue = {
    items,
    totalItems,
    subtotal,
    addItem,
    removeItem,
    updateQuantity,
    refresh,
    isCartFromApi,
    isLoading,
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider")
  }
  return ctx
}
