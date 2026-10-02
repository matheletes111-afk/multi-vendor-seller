import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isSuperAdmin } from "@/lib/rbac"
import { RolesClient } from "./roles-client"

export const metadata = {
  title: "Roles & Staff Permissions | Meeem Admin",
}

export default async function AdminRolesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/admin/login")
  }

  // Strictly enforce Super Admin access for Role & Permission management
  if (!isSuperAdmin(session.user)) {
    redirect("/admin")
  }

  return <RolesClient />
}
