import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { ProductSellerReviewsClient } from "./reviews-client"

export default async function ProductSellerReviewsPage() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/product-seller/login")
  }
  return <ProductSellerReviewsClient />
}

