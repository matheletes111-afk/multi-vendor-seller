"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { UserRole } from "@prisma/client"
import { ShoppingCart } from "lucide-react"

import { Button, type ButtonProps } from "@/ui/button"
import { useCart } from "@/app/cart/cart-context"

type Props = {
  productId: string
  name: string
  price: number
  image: string | null
  /**
   * Button size for compact product cards.
   * - `sm`: normal card width
   * - `icon`: best sellers / carousels
   */
  size?: ButtonProps["size"]
  /**
   * Optional button label (useful for short buttons like "Add").
   */
  label?: string
  /**
   * Whether to show the label next to the icon.
   */
  showLabel?: boolean
  ariaLabel?: string
  className?: string
}

export function AddToCartButton({
  productId,
  name,
  price,
  image,
  size = "sm",
  label = "Add to Cart",
  showLabel = true,
  ariaLabel,
  className,
}: Props) {
  const { addItem, isLoading } = useCart()
  const { data: session, status } = useSession()

  const canUseCart = status === "unauthenticated" || (status === "authenticated" && session?.user?.role === UserRole.CUSTOMER)
  const [added, setAdded] = useState(false)

  return (
    <Button
      type="button"
      size={size}
      className={[
        "bg-amber-400 text-black hover:bg-amber-500 touch-manipulation",
        size === "icon" ? "p-0" : "px-3",
        className ?? "",
      ].join(" ")}
      disabled={!canUseCart || isLoading}
      title={!canUseCart ? "Sign in as a customer to add to cart" : undefined}
      aria-label={showLabel ? undefined : ariaLabel ?? label}
      onClick={async (e) => {
        // Buttons can live inside a clickable product `<Link>`; prevent navigation on click.
        e.preventDefault()
        e.stopPropagation()

        if (!canUseCart) return
        const res = await addItem({
          productId,
          productVariantId: undefined,
          name,
          price,
          image,
        })

        if (!res || !("error" in res) || res.error == null) {
          setAdded(true)
          window.setTimeout(() => setAdded(false), 2500)
        }
      }}
    >
      <ShoppingCart className={showLabel ? "mr-2 h-4 w-4" : "h-4 w-4"} />
      {showLabel ? (added ? "Added" : label) : null}
    </Button>
  )
}

