import { PublicLayout } from "@/components/site-layout"
import { BrowseClient } from "@/app/customer/browse/browse-client"
import { Suspense } from "react"

export default function BrowsePage() {
  return (
    <PublicLayout>
      <Suspense
        fallback={
          <div className="container mx-auto p-6">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <BrowseClient />
      </Suspense>
    </PublicLayout>
  )
}
