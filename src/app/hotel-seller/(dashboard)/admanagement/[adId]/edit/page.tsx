import { EditAdForm } from "@/components/ads/edit-ad-form"

export default async function HotelSellerEditAdPage({
  params,
}: {
  params: Promise<{ adId: string }>
}) {
  const resolvedParams = await params
  return (
    <EditAdForm
      mode="hotel-seller"
      adId={resolvedParams.adId}
      apiBaseUrl="/api/hotel-seller/admanagement"
      backHref="/hotel-seller/admanagement"
    />
  )
}
