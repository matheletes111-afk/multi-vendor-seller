import { Metadata } from "next"
import { InAppSupportView } from "@/components/support/in-app-support-view"

export const metadata: Metadata = {
  title: "Restaurant Partner Support | MEEEM Food",
  description: "Get assistance with your menu listings, restaurant food orders, payouts, and kitchen operations.",
}

export default function RestaurantSellerSupportPage() {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 max-w-6xl">
      <InAppSupportView
        role="SELLER_RESTAURANT"
        panelTitle="Restaurant Partner"
        panelSlug="restaurant-seller"
      />
    </div>
  )
}
