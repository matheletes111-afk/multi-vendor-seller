import { auth } from "@/lib/auth"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { ServiceReviewDetailsClient } from "./review-details-client"

export default async function ServiceReviewDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    redirect("/service-seller/login")
  }
  const { id } = await params
  return <ServiceReviewDetailsClient serviceId={id} />
}

