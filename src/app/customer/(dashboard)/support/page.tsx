import { Metadata } from "next"
import { InAppSupportView } from "@/components/support/in-app-support-view"

export const metadata: Metadata = {
  title: "Customer Support | MEEEM Marketplace",
  description: "Get assistance with your customer orders, deliveries, refunds, and account.",
}

export default function CustomerSupportPage() {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 max-w-6xl">
      <InAppSupportView
        role="CUSTOMER"
        panelTitle="Customer"
        panelSlug="customer"
      />
    </div>
  )
}
