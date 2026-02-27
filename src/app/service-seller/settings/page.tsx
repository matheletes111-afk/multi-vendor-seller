import { auth } from "@/lib/auth"
import { isServiceSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { ServiceSettingsClient } from "./settings-client"

export default async function ServiceSellerSettingsPage() {
  const session = await auth()
  if (!session?.user || !isServiceSeller(session.user)) redirect("/login")
  return <ServiceSettingsClient />
}
