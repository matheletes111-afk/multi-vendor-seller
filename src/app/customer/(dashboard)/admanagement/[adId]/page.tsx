import { AdDashboardDetail } from "@/components/ads/ad-dashboard-detail"

export default async function CustomerAdDetailPage({
  params,
}: {
  params: Promise<{ adId: string }>
}) {
  const resolvedParams = await params
  return (
    <AdDashboardDetail
      adId={resolvedParams.adId}
      apiBaseUrl="/api/customer/admanagement"
      backHref="/customer/admanagement"
    />
  )
}
