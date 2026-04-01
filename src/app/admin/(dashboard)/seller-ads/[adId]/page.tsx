import { AdDashboardDetail } from "@/components/ads/ad-dashboard-detail"

export default async function AdminAdDetailPage({
  params,
}: {
  params: Promise<{ adId: string }>
}) {
  const resolvedParams = await params
  return (
    <AdDashboardDetail
      adId={resolvedParams.adId}
      apiBaseUrl="/api/admin/seller-ads"
      backHref="/admin/seller-ads"
    />
  )
}
