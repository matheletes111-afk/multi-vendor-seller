import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasBackofficeAccess, isSuperAdmin } from "@/lib/rbac"
import { AdminLayoutClient } from "../layout-client"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) redirect("/admin/login")
  if (!hasBackofficeAccess(session.user)) redirect("/dashboard")

  const isSuper = isSuperAdmin(session.user)
  const isBackoffice = (session.user as any).isBackofficeUser === true
  const permissions = (session.user as any).permissions || []
  const roleName = (session.user as any).roleName ?? (isSuper ? "Super Admin" : "Staff")

  return (
    <AdminLayoutClient
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        phone: session.user.phone ?? null,
        image: session.user.image ?? null,
        isSuperAdmin: isSuper,
        isBackofficeUser: isBackoffice,
        permissions,
        roleName,
      }}
    >
      {children}
    </AdminLayoutClient>
  )
}
