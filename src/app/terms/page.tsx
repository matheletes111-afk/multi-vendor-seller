import { Metadata } from "next"
import { Suspense } from "react"
import { TermsClient } from "./terms-client"
import { PageLoader } from "@/components/ui/page-loader"

export const metadata: Metadata = {
  title: "Legal & Policy Library | MEEEM Marketplace",
  description: "Explore all legal terms, privacy policies, seller agreements, and compliance standards for MEEEM Marketplace.",
}

export default function TermsPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading legal documents..." />}>
      <TermsClient />
    </Suspense>
  )
}
