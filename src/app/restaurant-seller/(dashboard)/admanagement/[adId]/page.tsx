import { AdDashboardDetail } from "@/components/ads/ad-dashboard-detail"

export default async function RestaurantSellerAdDetailPage({
  params,
}: {
  params: Promise<{ adId: string }>
}) {
  const resolvedParams = await params
  return (
    <AdDashboardDetail
      adId={resolvedParams.adId}
      apiBaseUrl="/api/restaurant-seller/admanagement"
      backHref="/restaurant-seller/admanagement"
    />
  )
}

