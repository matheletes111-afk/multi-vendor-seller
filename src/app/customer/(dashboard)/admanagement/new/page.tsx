import { NewAdForm } from "@/components/ads/new-ad-form"

export default function CustomerNewAdPage() {
  return (
    <NewAdForm
      mode="customer"
      submitUrl="/api/customer/admanagement"
      backHref="/customer/admanagement"
      listHref="/customer/admanagement"
      successPath="/customer/admanagement?success=Ad+created.+It+will+be+visible+after+admin+approval."
    />
  )
}
