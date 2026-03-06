import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isProductSeller } from "@/lib/rbac"
import { ProductSellerOrderDetailClient } from "./order-detail-client"

export default async function ProductSellerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) {
    redirect("/product-seller/login")
  }
  const { id: orderId } = await params
  return <ProductSellerOrderDetailClient orderId={orderId} />
}
