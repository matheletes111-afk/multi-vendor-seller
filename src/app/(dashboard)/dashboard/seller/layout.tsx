import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isSeller } from "@/lib/rbac"
import { logout } from "@/server/actions/auth/logout"
import { Header } from "@/components/navigation/header"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/navigation/sidebar"
import { NavItem } from "@/components/navigation/nav-item"
import { MobileNav } from "@/components/navigation/mobile-nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { prisma } from "@/lib/prisma"
import { LayoutDashboard, Package, Briefcase, ShoppingCart, CreditCard, Settings, ShoppingBag } from "lucide-react"

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

  async function handleLogout() {
    "use server"
    return await logout()
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden md:block">
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            <span className="text-lg font-semibold">Seller</span>
          </div>
          {seller && (
            <Badge variant="secondary" className="mt-2 w-fit text-xs">
              {seller.type.toLowerCase()} seller
            </Badge>
          )}
        </SidebarHeader>
        <SidebarContent>
          <NavItem href="/dashboard/seller" label="Overview" icon={LayoutDashboard} />
          {isProduct && (
            <NavItem href="/dashboard/seller/products" label="Products" icon={Package} />
          )}
          {isService && (
            <NavItem href="/dashboard/seller/services" label="Services" icon={Briefcase} />
          )}
          <NavItem href="/dashboard/seller/orders" label="Orders" icon={ShoppingCart} />
          <NavItem href="/dashboard/seller/subscription" label="Subscription" icon={CreditCard} />
          <NavItem href="/dashboard/seller/settings" label="Settings" icon={Settings} />
        </SidebarContent>
        <SidebarFooter>
          <form action={handleLogout}>
            <Button type="submit" variant="outline" className="w-full">
              Logout
            </Button>
          </form>
        </SidebarFooter>
      </Sidebar>
      <div className="flex flex-1 flex-col md:pl-64">
        <Header
          user={{
            name: session.user.name || undefined,
            email: session.user.email || undefined,
            image: session.user.image || undefined,
          }}
          onLogout={handleLogout}
        >
          <MobileNav>
            <SidebarContent>
              <NavItem href="/dashboard/seller" label="Overview" icon={LayoutDashboard} />
              {isProduct && (
                <NavItem href="/dashboard/seller/products" label="Products" icon={Package} />
              )}
              {isService && (
                <NavItem href="/dashboard/seller/services" label="Services" icon={Briefcase} />
              )}
              <NavItem href="/dashboard/seller/orders" label="Orders" icon={ShoppingCart} />
              <NavItem href="/dashboard/seller/subscription" label="Subscription" icon={CreditCard} />
              <NavItem href="/dashboard/seller/settings" label="Settings" icon={Settings} />
            </SidebarContent>
          </MobileNav>
        </Header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

