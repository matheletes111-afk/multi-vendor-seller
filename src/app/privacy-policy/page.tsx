import { Metadata } from "next"
import { Suspense } from "react"
import { TermsClient } from "../terms/terms-client"
import { PageLoader } from "@/components/ui/page-loader"

export const metadata: Metadata = {
  title: "Privacy Policy | MEEEM Marketplace",
  description: "Explore the official Privacy Policy, user data rights, security practices, and cookie policies for MEEEM Marketplace.",
}

export default function PrivacyPolicyPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading Privacy Policy..." />}>
      <TermsClient defaultSlug="privacy-policy" />
    </Suspense>
  )
}
