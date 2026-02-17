import Link from "next/link"
import Image from "next/image"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isCustomer } from "@/lib/rbac"
import { logout } from "@/server/actions/auth/logout"
import { Header } from "@/components/navigation/header"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/navigation/sidebar"
import { NavItem } from "@/components/navigation/nav-item"
import { MobileNav } from "@/components/navigation/mobile-nav"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, ShoppingCart, Store, ShoppingBag } from "lucide-react"

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user || !isCustomer(session.user)) {
    redirect("/login")
  }

  async function handleLogout() {
    "use server"
    return await logout()
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden md:block">
        <SidebarHeader>
          <Link href="/" className="flex w-full flex-col items-center gap-1.5 text-center">
            <Image src="/images/logo-three.jpeg" alt="Logo" width={200} height={56} className="h-14 w-auto object-contain shrink-0" />
            <span className="text-xs font-medium text-muted-foreground tracking-wide">Customer</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <NavItem href="/dashboard/customer" label="Overview" icon={<LayoutDashboard className="h-4 w-4" />} />
          <NavItem href="/dashboard/customer/orders" label="My Orders" icon={<ShoppingCart className="h-4 w-4" />} />
          <NavItem href="/browse" label="Browse Marketplace" icon={<Store className="h-4 w-4" />} />
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
              <NavItem href="/dashboard/customer" label="Overview" icon={<LayoutDashboard className="h-4 w-4" />} />
              <NavItem href="/dashboard/customer/orders" label="My Orders" icon={<ShoppingCart className="h-4 w-4" />} />
              <NavItem href="/browse" label="Browse Marketplace" icon={<Store className="h-4 w-4" />} />
            </SidebarContent>
          </MobileNav>
        </Header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

