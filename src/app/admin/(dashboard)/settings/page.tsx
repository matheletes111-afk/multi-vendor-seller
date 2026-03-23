import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { AdminSettingsClient } from "./settings-client"

export default async function AdminSettingsPage() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user)) redirect("/admin/login")
  return <AdminSettingsClient />
}
