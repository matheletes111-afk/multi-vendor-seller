import { AdDashboardDetail } from "@/components/ads/ad-dashboard-detail"

export default async function ServiceSellerAdDetailPage({
  params,
}: {
  params: Promise<{ adId: string }>
}) {
  const resolvedParams = await params
  return (
    <AdDashboardDetail
      adId={resolvedParams.adId}
      apiBaseUrl="/api/service-seller/admanagement"
      backHref="/service-seller/admanagement"
    />
  )
}
