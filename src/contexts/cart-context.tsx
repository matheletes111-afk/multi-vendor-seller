"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { getCartFromStorage, setCartInStorage, getCartItemId, type CartItem } from "@/lib/cart"

type CartContextValue = {
  items: CartItem[]
  totalItems: number
  subtotal: number
  addItem: (item: Omit<CartItem, "quantity"> | CartItem) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  refresh: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  const refresh = useCallback(() => {
    setItems([...getCartFromStorage()])
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("meeem-cart-update", handler)
    return () => window.removeEventListener("meeem-cart-update", handler)
  }, [refresh])

  const addItem = useCallback(
    (input: Omit<CartItem, "quantity"> | CartItem) => {
      const quantity = "quantity" in input ? input.quantity : 1
      const next = getCartFromStorage()
      const existing = next.find(
        (i) =>
          (input.productId && i.productId === input.productId) ||
          (input.serviceId && i.serviceId === input.serviceId)
      )
      if (existing) {
        existing.quantity += quantity
      } else {
        next.push({
          productId: input.productId,
          serviceId: input.serviceId,
          name: input.name,
          price: input.price,
          image: input.image ?? null,
          quantity,
        })
      }
      setCartInStorage(next)
      setItems([...next])
    },
    []
  )

  const removeItem = useCallback((itemId: string) => {
    const next = getCartFromStorage().filter((i) => getCartItemId(i) !== itemId)
    setCartInStorage(next)
    setItems([...next])
  }, [])

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(itemId)
      return
    }
    const next = getCartFromStorage().map((i) =>
      getCartItemId(i) === itemId ? { ...i, quantity } : i
    )
    setCartInStorage(next)
    setItems([...next])
  }, [removeItem])

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
