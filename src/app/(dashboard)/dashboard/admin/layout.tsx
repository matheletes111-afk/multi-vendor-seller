import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/rbac"
import Link from "next/link"
import { logout } from "@/server/actions/auth/logout"
import { Button } from "@/components/ui/button"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r p-4 flex flex-col">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Admin Dashboard</h2>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
        </div>
        <nav className="space-y-2 flex-1">
          <Link href="/dashboard/admin" className="block px-4 py-2 rounded hover:bg-accent">
            Overview
          </Link>
          <Link href="/dashboard/admin/sellers" className="block px-4 py-2 rounded hover:bg-accent">
            Sellers
          </Link>
          <Link href="/dashboard/admin/subscriptions" className="block px-4 py-2 rounded hover:bg-accent">
            Subscriptions
          </Link>
          <Link href="/dashboard/admin/categories" className="block px-4 py-2 rounded hover:bg-accent">
            Categories
          </Link>
        </nav>
        <form action={logout} className="mt-4">
          <Button type="submit" variant="outline" className="w-full">
            Logout
          </Button>
        </form>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  )
}

