import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/rbac"
import { logout } from "@/server/actions/auth/logout"
import { Header } from "@/components/navigation/header"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/navigation/sidebar"
import { NavItem } from "@/components/navigation/nav-item"
import { MobileNav } from "@/components/navigation/mobile-nav"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Users, CreditCard, FolderTree, ShoppingBag } from "lucide-react"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user || !isAdmin(session.user)) {
    redirect("/dashboard")
  }

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
            <span className="text-lg font-semibold">Admin</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <NavItem href="/dashboard/admin" label="Overview" icon={LayoutDashboard} />
          <NavItem href="/dashboard/admin/sellers" label="Sellers" icon={Users} />
          <NavItem href="/dashboard/admin/subscriptions" label="Subscriptions" icon={CreditCard} />
          <NavItem href="/dashboard/admin/categories" label="Categories" icon={FolderTree} />
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
              <NavItem href="/dashboard/admin" label="Overview" icon={LayoutDashboard} />
              <NavItem href="/dashboard/admin/sellers" label="Sellers" icon={Users} />
              <NavItem href="/dashboard/admin/subscriptions" label="Subscriptions" icon={CreditCard} />
              <NavItem href="/dashboard/admin/categories" label="Categories" icon={FolderTree} />
            </SidebarContent>
          </MobileNav>
        </Header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

