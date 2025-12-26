import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isCustomer } from "@/lib/rbac"
import { logout } from "@/server/actions/auth/logout"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user || !isCustomer(session.user)) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r p-4 flex flex-col">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Customer Dashboard</h2>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
        </div>
        <nav className="space-y-2 flex-1">
          <Link href="/dashboard/customer" className="block px-4 py-2 rounded hover:bg-accent">
            Overview
          </Link>
          <Link href="/dashboard/customer/orders" className="block px-4 py-2 rounded hover:bg-accent">
            My Orders
          </Link>
          <Link href="/browse" className="block px-4 py-2 rounded hover:bg-accent">
            Browse Marketplace
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

