import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/rbac"
import Link from "next/link"

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
      <aside className="w-64 border-r p-4">
        <nav className="space-y-2">
          <Link href="/dashboard/admin" className="block px-4 py-2 rounded hover:bg-accent">
            Overview
          </Link>
          <Link href="/dashboard/admin/sellers" className="block px-4 py-2 rounded hover:bg-accent">
            Sellers
          </Link>
          <Link href="/dashboard/admin/categories" className="block px-4 py-2 rounded hover:bg-accent">
            Categories
          </Link>
        </nav>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  )
}

