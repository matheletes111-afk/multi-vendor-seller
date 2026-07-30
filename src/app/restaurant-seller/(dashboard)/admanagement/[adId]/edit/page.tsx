import { EditAdForm } from "@/components/ads/edit-ad-form"

export default async function RestaurantSellerEditAdPage({
  params,
}: {
  params: Promise<{ adId: string }>
}) {
  const resolvedParams = await params
  return (
    <EditAdForm
      mode="restaurant-seller"
      adId={resolvedParams.adId}
      apiBaseUrl="/api/restaurant-seller/admanagement"
      backHref="/restaurant-seller/admanagement"
    />
  )
}
