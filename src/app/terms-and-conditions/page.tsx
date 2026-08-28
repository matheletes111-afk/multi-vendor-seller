import { Metadata } from "next"
import { Suspense } from "react"
import { TermsClient } from "../terms/terms-client"
import { PageLoader } from "@/components/ui/page-loader"

export const metadata: Metadata = {
  title: "Terms and Conditions | MEEEM Marketplace",
  description: "Explore the official Terms and Conditions, multi-vendor rules, 4-tier category base commissions, and dispute policies for MEEEM Marketplace.",
}

export default function TermsAndConditionsPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading Terms & Conditions..." />}>
      <TermsClient defaultSlug="terms-and-conditions" />
    </Suspense>
  )
}
