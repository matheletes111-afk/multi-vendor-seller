import { Metadata } from "next"
import { InAppSupportView } from "@/components/support/in-app-support-view"

export const metadata: Metadata = {
  title: "Hotel Host Support | MEEEM Hotels",
  description: "Get assistance with your hotel properties, room listings, guest bookings, and reservations.",
}

export default function HotelSellerSupportPage() {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 max-w-6xl">
      <InAppSupportView
        role="SELLER_HOTEL"
        panelTitle="Hotel Host"
        panelSlug="hotel-seller"
      />
    </div>
  )
}
