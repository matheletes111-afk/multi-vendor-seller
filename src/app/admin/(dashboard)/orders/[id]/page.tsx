import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { AdminOrderDetailClient } from "./order-detail-client"

export default async function AdminOrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  const params = await props.params
  return <AdminOrderDetailClient orderId={params.id} />
}
