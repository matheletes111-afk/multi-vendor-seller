import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { AdminRestaurantOrdersClient } from "./orders-client"

export default async function AdminRestaurantOrdersPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  return <AdminRestaurantOrdersClient />
}
