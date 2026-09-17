import { Metadata } from "next"
import { Suspense } from "react"
import { RiderTermsClient } from "./rider-terms-client"
import { PageLoader } from "@/components/ui/page-loader"

export const metadata: Metadata = {
  title: "Delivery Partner & Rider Terms & Privacy Policy | MEEEM Marketplace",
  description: "Official Delivery Partner Terms & Conditions and Privacy Policy for MEEEM Marketplace couriers in Sierra Leone. Learn about independent contractor rights, weekly payouts, 100% tip policy, safety guidelines, and GPS tracking disclosures.",
  keywords: [
    "Rider Terms and Conditions",
    "MEEEM Delivery Partner",
    "Courier Privacy Policy",
    "Rider GPS Tracking Policy",
    "Sierra Leone Courier Agreement",
    "MEEEM Rider Portal",
  ],
}

export default function RiderTermsPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading Rider Terms & Policies..." />}>
      <RiderTermsClient />
    </Suspense>
  )
}
