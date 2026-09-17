import { SellerAnalyticsClient } from "@/app/admin/(dashboard)/sellers/[id]/analytics/seller-analytics-client"

interface RestaurantSellerAnalyticsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function RestaurantSellerAnalyticsPage({ params }: RestaurantSellerAnalyticsPageProps) {
  const { id } = await params

  return (
    <SellerAnalyticsClient id={id} initialSellerType="RESTAURANT" />
  )
}
