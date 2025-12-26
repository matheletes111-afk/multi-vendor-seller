import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isSeller, isProductSeller, isServiceSeller } from "@/lib/rbac"
import Link from "next/link"
import { logout } from "@/server/actions/auth/logout"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user || !isSeller(session.user)) {
    redirect("/login")
  }

  // Get seller type
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
  })

  const isProduct = seller?.type === "PRODUCT"
  const isService = seller?.type === "SERVICE"

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r p-4 flex flex-col">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Seller Dashboard</h2>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
          <p className="text-xs text-muted-foreground capitalize mt-1">
            {seller?.type.toLowerCase()} seller
          </p>
        </div>
        <nav className="space-y-2 flex-1">
          <Link href="/dashboard/seller" className="block px-4 py-2 rounded hover:bg-accent">
            Overview
          </Link>
          {isProduct && (
            <Link href="/dashboard/seller/products" className="block px-4 py-2 rounded hover:bg-accent">
              Products
            </Link>
          )}
          {isService && (
            <Link href="/dashboard/seller/services" className="block px-4 py-2 rounded hover:bg-accent">
              Services
            </Link>
          )}
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

