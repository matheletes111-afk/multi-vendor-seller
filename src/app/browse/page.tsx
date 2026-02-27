import { PublicLayout } from "@/components/site-layout"
import { BrowseClient } from "@/app/customer/browse/browse-client"
import { PageLoader } from "@/components/ui/page-loader"
import { Suspense } from "react"

export default function BrowsePage() {
  return (
    <PublicLayout>
      <Suspense fallback={<PageLoader variant="listing" message="Loading…" />}>
        <BrowseClient />
      </Suspense>
    </PublicLayout>
  )
}
