import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isServiceSeller } from "@/lib/rbac"
import { ServiceSellerOrderDetailClient } from "./order-detail-client"

export default async function ServiceSellerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) {
    redirect("/service-seller/login")
  }
  const { id: orderId } = await params
  return <ServiceSellerOrderDetailClient orderId={orderId} />
}
