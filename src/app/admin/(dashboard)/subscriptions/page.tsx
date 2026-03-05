import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { SubscriptionsClient } from "./subscriptions-client"

export default async function AdminSubscriptionsPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }
  return <SubscriptionsClient />
}
