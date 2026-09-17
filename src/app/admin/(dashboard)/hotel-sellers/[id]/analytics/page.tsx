import { SellerAnalyticsClient } from "@/app/admin/(dashboard)/sellers/[id]/analytics/seller-analytics-client"

interface HotelSellerAnalyticsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function HotelSellerAnalyticsPage({ params }: HotelSellerAnalyticsPageProps) {
  const { id } = await params

  return (
    <SellerAnalyticsClient id={id} initialSellerType="HOTEL" />
  )
}
