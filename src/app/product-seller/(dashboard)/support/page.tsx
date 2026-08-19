import { Metadata } from "next"
import { InAppSupportView } from "@/components/support/in-app-support-view"

export const metadata: Metadata = {
  title: "Seller Support Desk | MEEEM Product Seller",
  description: "Get assistance with your store listings, payouts, inventory, and order fulfillment.",
}

export default function ProductSellerSupportPage() {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 max-w-6xl">
      <InAppSupportView
        role="SELLER_PRODUCT"
        panelTitle="Product Seller"
        panelSlug="product-seller"
      />
    </div>
  )
}
