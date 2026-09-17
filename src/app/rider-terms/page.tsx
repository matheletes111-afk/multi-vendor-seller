import { Metadata } from "next"
import { Suspense } from "react"
import { RiderTermsClient } from "./rider-terms-client"
import { PageLoader } from "@/components/ui/page-loader"

export const metadata: Metadata = {
  title: "MEEEM Rider & Driver Employment Terms & Delivery App Privacy Policy | MEEEM",
  description: "Official MEEEM Rider and Driver Employment Terms and Conditions and Delivery App Privacy Policy for employed couriers under the laws of Sierra Leone and Employment Act 2023.",
  keywords: [
    "MEEEM Rider Terms and Conditions",
    "MEEEM Delivery App Privacy Policy",
    "Rider and Driver Employment Terms",
    "Courier Privacy Policy",
    "Sierra Leone Delivery Partner",
    "Employment Act 2023",
  ],
}

export default function RiderTermsPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading Rider Terms & Policies..." />}>
      <RiderTermsClient />
    </Suspense>
  )
}
