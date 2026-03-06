"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  addItem: (item: Omit<CartItem, "quantity"> | CartItem) => void
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

  useEffect(() => {
    if (!isCustomer) {
      const handler = () => setItems([...getCartFromStorage()])
      window.addEventListener("meeem-cart-update", handler)
      return () => window.removeEventListener("meeem-cart-update", handler)
    }
  }, [isCustomer])

  const addItem = useCallback(
    async (input: Omit<CartItem, "quantity"> | CartItem) => {
      const quantity = "quantity" in input ? input.quantity : 1
      if (isCustomer) {
        setIsLoading(true)
        try {
          const body: { productId?: string; productVariantId?: string; serviceId?: string; servicePackageId?: string; serviceSlotId?: string; quantity: number } = { quantity }
          if (input.productId) {
            body.productId = input.productId
            if (input.productVariantId) body.productVariantId = input.productVariantId
          } else if (input.serviceId) {
            body.serviceId = input.serviceId
            if (input.servicePackageId) body.servicePackageId = input.servicePackageId
            if (input.serviceSlotId) body.serviceSlotId = input.serviceSlotId
          } else {
            setIsLoading(false)
            return
          }
          const res = await fetch("/api/customer/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          })
          if (res.ok) {
            const data = (await res.json()) as CartItemApi[]
            setItems(Array.isArray(data) ? data.map(mapApiItemToCartItem) : [])
          }
        } finally {
          setIsLoading(false)
        }
        return
      }
      const next = getCartFromStorage()
      const sameLine = (i: CartItem) =>
        input.productId && i.productId === input.productId
          ? (input as CartItem).productVariantId != null
            ? i.productVariantId === (input as CartItem).productVariantId
            : i.productVariantId == null
          : input.serviceId && i.serviceId === input.serviceId
            ? (i.servicePackageId ?? null) === ((input as CartItem).servicePackageId ?? null) &&
              (i.serviceSlotId ?? null) === ((input as CartItem).serviceSlotId ?? null)
            : false
      const existing = next.find(sameLine)
      if (existing) {
        existing.quantity += quantity
      } else {
        next.push({
          productId: input.productId,
          productVariantId: (input as CartItem).productVariantId,
          serviceId: input.serviceId,
          servicePackageId: (input as CartItem).servicePackageId,
          serviceSlotId: (input as CartItem).serviceSlotId,
          name: input.name,
          price: input.price,
          image: input.image ?? null,
          quantity,
        })
      }
      setCartInStorage(next)
      setItems([...next])
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
      if (isCustomer) {
        const item = items.find((i) => getCartItemId(i) === itemId)
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

  const totalItems = items.reduce((n, i) => n + i.quantity, 0)
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)

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
