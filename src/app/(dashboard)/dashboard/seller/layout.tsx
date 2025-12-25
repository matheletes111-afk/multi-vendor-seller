import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isSeller } from "@/lib/rbac"
import Link from "next/link"
import { signOut } from "@/lib/auth"

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user || !isSeller(session.user)) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r p-4">
        <nav className="space-y-2">
          <Link href="/dashboard/seller" className="block px-4 py-2 rounded hover:bg-accent">
            Overview
          </Link>
          <Link href="/dashboard/seller/products" className="block px-4 py-2 rounded hover:bg-accent">
            Products
          </Link>
          <Link href="/dashboard/seller/services" className="block px-4 py-2 rounded hover:bg-accent">
            Services
          </Link>
          <Link href="/dashboard/seller/orders" className="block px-4 py-2 rounded hover:bg-accent">
            Orders
          </Link>
          <Link href="/dashboard/seller/subscription" className="block px-4 py-2 rounded hover:bg-accent">
            Subscription
          </Link>
          <Link href="/dashboard/seller/settings" className="block px-4 py-2 rounded hover:bg-accent">
            Settings
          </Link>
        </nav>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  )
}

