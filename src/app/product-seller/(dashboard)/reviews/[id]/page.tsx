import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { ReviewDetailsClient } from "./review-details-client"

export default async function ProductReviewDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/product-seller/login")
  }
  const { id } = await params
  return <ReviewDetailsClient productId={id} />
}

