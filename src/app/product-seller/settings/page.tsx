import { auth } from "@/lib/auth"
import { isProductSeller } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { SettingsClient } from "./settings-client"

export default async function ProductSellerSettingsPage() {
  const session = await auth()
  if (!session?.user || !isProductSeller(session.user)) redirect("/login")
  return <SettingsClient />
}
