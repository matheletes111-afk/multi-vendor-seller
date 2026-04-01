import { AdDashboardDetail } from "@/components/ads/ad-dashboard-detail"

export default async function ProductSellerAdDetailPage({
  params,
}: {
  params: Promise<{ adId: string }>
}) {
  const resolvedParams = await params
  return (
    <AdDashboardDetail
      adId={resolvedParams.adId}
      apiBaseUrl="/api/product-seller/admanagement"
      backHref="/product-seller/admanagement"
    />
  )
}
