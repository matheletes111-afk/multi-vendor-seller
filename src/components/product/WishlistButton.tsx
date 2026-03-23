"use client"

import { Heart } from "lucide-react"
import { useSession } from "next-auth/react"
import { UserRole } from "@prisma/client"
import { Button } from "@/ui/button"
import { useWishlist } from "@/app/wishlist/wishlist-context"

type WishlistButtonProps = {
  productId: string
  className?: string
}

export function WishlistButton({ productId, className }: WishlistButtonProps) {
  const { status, data: session } = useSession()
  const { canUseWishlist, isWishlisted, toggleWishlist, loading } = useWishlist()

  if (status !== "authenticated" || session?.user?.role !== UserRole.CUSTOMER || !canUseWishlist) {
    return null
  }

  const active = isWishlisted(productId)

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      disabled={loading}
      className={`h-8 w-8 rounded-full bg-white/95 text-slate-700 shadow hover:bg-white ${className ?? ""}`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void toggleWishlist(productId)
      }}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      title={active ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart className={`h-4 w-4 ${active ? "fill-rose-500 text-rose-500" : "text-slate-700"}`} />
    </Button>
  )
}

