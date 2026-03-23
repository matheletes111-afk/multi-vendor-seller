import { auth } from "@/lib/auth"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { ServiceSellerReviewsClient } from "./reviews-client"

export default async function ServiceSellerReviewsPage() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    redirect("/service-seller/login")
  }
  return <ServiceSellerReviewsClient />
}

