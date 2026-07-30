import { EditAdForm } from "@/components/ads/edit-ad-form"

export default async function ProductSellerEditAdPage({
  params,
}: {
  params: Promise<{ adId: string }>
}) {
  const resolvedParams = await params
  return (
    <EditAdForm
      mode="product-seller"
      adId={resolvedParams.adId}
      apiBaseUrl="/api/product-seller/admanagement"
      backHref="/product-seller/admanagement"
    />
  )
}
