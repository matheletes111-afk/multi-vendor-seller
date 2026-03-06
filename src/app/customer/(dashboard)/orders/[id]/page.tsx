import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isCustomer } from "@/lib/rbac"
import { OrderDetailClient } from "./order-detail-client"

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user || !isCustomer(session.user)) {
    redirect("/customer/login")
  }
  const { id: orderId } = await params
  return <OrderDetailClient orderId={orderId} />
}
