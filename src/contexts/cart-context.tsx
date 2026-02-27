"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { getCartFromStorage, setCartInStorage, type CartItem } from "@/lib/cart"

type CartContextValue = {
  items: CartItem[]
  totalItems: number
  subtotal: number
  addItem: (item: Omit<CartItem, "quantity"> | CartItem) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
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
      const existing = next.find((i) => i.productId === input.productId)
      if (existing) {
        existing.quantity += quantity
      } else {
        next.push({
          productId: input.productId,
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

  const removeItem = useCallback((productId: string) => {
    const next = getCartFromStorage().filter((i) => i.productId !== productId)
    setCartInStorage(next)
    setItems([...next])
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(productId)
      return
    }
    const next = getCartFromStorage().map((i) =>
      i.productId === productId ? { ...i, quantity } : i
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
