import { Metadata } from "next"
import { InAppSupportView } from "@/components/support/in-app-support-view"

export const metadata: Metadata = {
  title: "Service Provider Support | MEEEM Services",
  description: "Get assistance with your service bookings, appointments, payouts, and customer inquiries.",
}

export default function ServiceSellerSupportPage() {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 max-w-6xl">
      <InAppSupportView
        role="SELLER_SERVICE"
        panelTitle="Service Provider"
        panelSlug="service-seller"
      />
    </div>
  )
}
