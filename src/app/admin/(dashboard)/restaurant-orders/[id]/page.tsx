import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { AdminRestaurantOrderDetailsClient } from "./order-details-client"

export default async function AdminRestaurantOrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  const params = await props.params
  return <AdminRestaurantOrderDetailsClient orderId={params.id} />
}
