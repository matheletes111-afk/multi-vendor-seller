import { auth } from "@/lib/auth"
import { isCustomer } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { CustomerSettingsClient } from "./settings-client"

export default async function CustomerSettingsPage() {
  const session = await auth()
  if (!session?.user || !isCustomer(session.user)) redirect("/customer/login")
  return <CustomerSettingsClient />
}
