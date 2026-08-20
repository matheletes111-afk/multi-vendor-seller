"use client"

import { Heart } from "lucide-react"
import { useSession } from "next-auth/react"
import { UserRole } from "@prisma/client"
import { Button } from "@/ui/button"
import { useWishlist, type WishlistMeta } from "@/app/wishlist/wishlist-context"

type WishlistButtonProps = {
  productId?: string
  serviceId?: string
  hotelId?: string
  foodItemId?: string
  name?: string
  image?: string | null
  price?: number | null
  city?: string | null
  starRating?: number
  isVeg?: boolean
  category?: string
  restaurantName?: string
  className?: string
  iconClassName?: string
}

export function WishlistButton({
  productId,
  serviceId,
  hotelId,
  foodItemId,
  name,
  image,
  price,
  city,
  starRating,
  isVeg,
  category,
  restaurantName,
  className,
  iconClassName,
}: WishlistButtonProps) {
  const { status, data: session } = useSession()
  const { canUseWishlist, isWishlisted, toggleWishlist, loading } = useWishlist()

  // Sellers and Admin cannot see or use customer wishlist
  if (status === "authenticated" && session?.user?.role !== UserRole.CUSTOMER) {
    return null
  }

  if (!canUseWishlist) {
    return null
  }

  const active = isWishlisted(productId, serviceId, hotelId, foodItemId)

  const meta: WishlistMeta = {
    name,
    image,
    price,
    city,
    starRating,
    isVeg,
    category,
    restaurantName,
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      disabled={loading}
      className={`h-8 w-8 rounded-full bg-white/95 text-slate-700 shadow hover:bg-white transition-all ${className ?? ""}`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void toggleWishlist(productId, serviceId, hotelId, foodItemId, meta)
      }}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      title={active ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart
        className={`h-4 w-4 transition-colors ${
          active ? "fill-rose-500 text-rose-500" : "text-slate-700"
        } ${iconClassName ?? ""}`}
      />
    </Button>
  )
}
