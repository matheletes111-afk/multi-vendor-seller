import { AdDashboardDetail } from "@/components/ads/ad-dashboard-detail"

export default async function HotelSellerAdDetailPage({
  params,
}: {
  params: Promise<{ adId: string }>
}) {
  const resolvedParams = await params
  return (
    <AdDashboardDetail
      adId={resolvedParams.adId}
      apiBaseUrl="/api/hotel-seller/admanagement"
      backHref="/hotel-seller/admanagement"
    />
  )
}

