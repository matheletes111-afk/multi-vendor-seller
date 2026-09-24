import { Suspense } from "react"
import { PageLoader } from "@/components/ui/page-loader"
import { SellerAnalyticsClient } from "@/app/admin/(dashboard)/sellers/[id]/analytics/seller-analytics-client"

interface RestaurantSellerAnalyticsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function RestaurantSellerAnalyticsPage({ params }: RestaurantSellerAnalyticsPageProps) {
  const { id } = await params

  return (
    <Suspense fallback={<PageLoader />}>
      <SellerAnalyticsClient id={id} initialSellerType="RESTAURANT" />
    </Suspense>
  )
}
