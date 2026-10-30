import { auth } from "@/lib/auth"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { NewAdForm } from "@/components/ads/new-ad-form"

export default async function ServiceSellerNewAdPage() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/service-seller/login")

  return (
    <NewAdForm
      mode="service-seller"
      submitUrl="/api/service-seller/admanagement"
      backHref="/service-seller/admanagement"
      listHref="/service-seller/admanagement"
      successPath="/service-seller/admanagement?success=Ad+created.+It+will+be+visible+after+admin+approval."
    />
  )
}
