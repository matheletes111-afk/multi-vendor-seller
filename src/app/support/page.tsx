import { Metadata } from "next"
import { PublicLayout } from "@/components/site-layout"
import { SupportPortalClient } from "./support-client"

export const metadata: Metadata = {
  title: "Customer & Vendor Support Desk | MEEEM Marketplace",
  description: "Get dedicated assistance for your customer orders, seller accounts, services, food orders, and hotel bookings on MEEEM Marketplace.",
}

export default function SupportPage() {
  return (
    <PublicLayout>
      <SupportPortalClient />
    </PublicLayout>
  )
}
