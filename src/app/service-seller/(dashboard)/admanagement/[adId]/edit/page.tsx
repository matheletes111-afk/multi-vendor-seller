import { EditAdForm } from "@/components/ads/edit-ad-form"

export default async function ServiceSellerEditAdPage({
  params,
}: {
  params: Promise<{ adId: string }>
}) {
  const resolvedParams = await params
  return (
    <EditAdForm
      mode="service-seller"
      adId={resolvedParams.adId}
      apiBaseUrl="/api/service-seller/admanagement"
      backHref="/service-seller/admanagement"
    />
  )
}
