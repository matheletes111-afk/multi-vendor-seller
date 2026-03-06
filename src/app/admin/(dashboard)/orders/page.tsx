import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { AdminOrdersClient } from "./orders-client"

export default async function AdminOrdersPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  return <AdminOrdersClient />
}
