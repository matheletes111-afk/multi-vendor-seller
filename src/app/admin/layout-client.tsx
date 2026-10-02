"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { ReactNode, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Separator } from "@/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/ui/sheet"
import {
  LogOut,
  User,
  LayoutDashboard,
  Users,
  CreditCard,
  FolderTree,
  Briefcase,
  Menu,
  BadgeDollarSign,
  ImageIcon,
  ShoppingCart,
  Star,
  Building2,
  Calendar,
  Package,
  Utensils,
  Ticket,
  LifeBuoy,
  Bike,
  Radio,
  Shield,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react"
import { DashboardFooter } from "@/components/layout/dashboard-footer"
import { isPathPermitted, getFirstAllowedPath, SUPER_ADMIN_ONLY_PREFIXES } from "@/lib/permissions"

function NavItem({
  href,
  label,
  icon,
  moduleKey,
  isSuperAdmin,
  permissions,
  isSuperAdminOnly,
}: {
  href: string
  label: string
  icon?: ReactNode
  moduleKey?: string
  isSuperAdmin?: boolean
  permissions?: string[]
  isSuperAdminOnly?: boolean
}) {
  const pathname = usePathname()

  // If this item is strictly Super Admin only
  if (isSuperAdminOnly && !isSuperAdmin) {
    return null
  }

  // If staff user and this module is not permitted, do not render item
  if (!isSuperAdmin && moduleKey) {
    if (!permissions || !permissions.includes(moduleKey)) {
      return null
    }
  }

  const isActive =
    pathname === href ||
    (href !== "/admin" && href !== "/admin/riders" && pathname?.startsWith(`${href}/`)) ||
    (href === "/admin/riders" && pathname === "/admin/riders")

  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-blue-50 text-blue-700 font-bold dark:bg-blue-950/40 dark:text-blue-300"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {icon && <span className="h-4 w-4 shrink-0">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
    </Link>
  )
}

function Sidebar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside className={cn("fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background transition-transform", className)}>
      <div className="flex h-full flex-col">{children}</div>
    </aside>
  )
}

export function AdminLayoutClient({
  children,
  user,
}: {
  children: ReactNode
  user: {
    name?: string | null
    email?: string | null
    phone?: string | null
    image?: string | null
    isSuperAdmin?: boolean
    isBackofficeUser?: boolean
    permissions?: string[]
    roleName?: string | null
  }
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const pathname = usePathname()
  const userInitials =
    user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ||
    user?.email?.[0].toUpperCase() ||
    user?.phone?.slice(-2) ||
    "U"

  const isSuper = !!user.isSuperAdmin
  const isStaff = !!user.isBackofficeUser
  const permissions = user.permissions || []

  // Check section visibility for staff users
  const canSeeSection = (keys: string[]) => {
    if (isSuper) return true
    return keys.some((k) => permissions.includes(k))
  }

  // ── ROUTE GUARD: Check if current URL is unauthorized for this staff member ──
  const isSuperAdminOnlyPath = SUPER_ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`)
  )
  const isUnauthorized = isStaff && !isSuper && (isSuperAdminOnlyPath || !isPathPermitted(pathname, permissions))

  const navContent = (
    <div className="space-y-4">
      {/* ── MASTER SECTION ── */}
      {canSeeSection([
        "dashboard",
        "all-sellers",
        "riders",
        "support",
        "banners",
        "subscriptions",
        "seller-ads",
        "reviews",
        "settings",
        "coupons",
      ]) || isSuper ? (
        <div>
          <div className="px-3 mb-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Master
          </div>
          <div className="space-y-0.5">
            <NavItem href="/admin" label="Dashboard" icon={<LayoutDashboard className="h-4 w-4" />} moduleKey="dashboard" isSuperAdmin={isSuper} permissions={permissions} />
            <NavItem href="/admin/all-sellers" label="All Sellers" icon={<Users className="h-4 w-4" />} moduleKey="all-sellers" isSuperAdmin={isSuper} permissions={permissions} />
            <NavItem href="/admin/riders" label="Riders" icon={<Bike className="h-4 w-4" />} moduleKey="riders" isSuperAdmin={isSuper} permissions={permissions} />
            <NavItem href="/admin/riders/live-track" label="Live Tracking" icon={<Radio className="h-4 w-4 text-emerald-600 animate-pulse" />} moduleKey="riders" isSuperAdmin={isSuper} permissions={permissions} />
            <NavItem href="/admin/support" label="Support Tickets" icon={<LifeBuoy className="h-4 w-4" />} moduleKey="support" isSuperAdmin={isSuper} permissions={permissions} />
            <NavItem href="/admin/banners" label="Banners" icon={<ImageIcon className="h-4 w-4" />} moduleKey="banners" isSuperAdmin={isSuper} permissions={permissions} />
            <NavItem href="/admin/subscriptions" label="Subscriptions" icon={<CreditCard className="h-4 w-4" />} moduleKey="subscriptions" isSuperAdmin={isSuper} permissions={permissions} />
            <NavItem href="/admin/seller-ads" label="Ads" icon={<BadgeDollarSign className="h-4 w-4" />} moduleKey="seller-ads" isSuperAdmin={isSuper} permissions={permissions} />
            <NavItem href="/admin/reviews" label="Reviews" icon={<Star className="h-4 w-4" />} moduleKey="reviews" isSuperAdmin={isSuper} permissions={permissions} />
            <NavItem href="/admin/settings" label="Settings" icon={<User className="h-4 w-4" />} moduleKey="settings" isSuperAdmin={isSuper} permissions={permissions} />
            <NavItem href="/admin/coupons" label="Coupons" icon={<Ticket className="h-4 w-4" />} moduleKey="coupons" isSuperAdmin={isSuper} permissions={permissions} />

            {/* Super Admin-Only Section for Roles & Staff */}
            {isSuper && (
              <NavItem
                href="/admin/roles"
                label="Roles & Staff"
                icon={<Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                isSuperAdminOnly={true}
                isSuperAdmin={isSuper}
              />
            )}
          </div>
        </div>
      ) : null}

      {/* ── PRODUCTS & SERVICES SECTION ── */}
      {canSeeSection(["categories", "products", "service-categories", "services", "sellers", "orders"]) && (
        <>
          <Separator className="bg-slate-200 dark:bg-slate-800 my-1" />
          <div>
            <div className="px-3 mb-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Products & Services
            </div>
            <div className="space-y-0.5">
              <NavItem href="/admin/categories" label="Product Category" icon={<FolderTree className="h-4 w-4" />} moduleKey="categories" isSuperAdmin={isSuper} permissions={permissions} />
              <NavItem href="/admin/products" label="Products" icon={<Package className="h-4 w-4" />} moduleKey="products" isSuperAdmin={isSuper} permissions={permissions} />
              <NavItem href="/admin/service-categories" label="Service Category" icon={<Briefcase className="h-4 w-4" />} moduleKey="service-categories" isSuperAdmin={isSuper} permissions={permissions} />
              <NavItem href="/admin/services" label="Services" icon={<Briefcase className="h-4 w-4" />} moduleKey="services" isSuperAdmin={isSuper} permissions={permissions} />
              <NavItem href="/admin/sellers" label="Product/Service Sellers" icon={<Users className="h-4 w-4" />} moduleKey="sellers" isSuperAdmin={isSuper} permissions={permissions} />
              <NavItem href="/admin/orders" label="Product/Service Orders" icon={<ShoppingCart className="h-4 w-4" />} moduleKey="orders" isSuperAdmin={isSuper} permissions={permissions} />
            </div>
          </div>
        </>
      )}

      {/* ── HOTELS SECTION ── */}
      {canSeeSection(["hotel-sellers", "hotels", "bookings"]) && (
        <>
          <Separator className="bg-slate-200 dark:bg-slate-800 my-1" />
          <div>
            <div className="px-3 mb-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Hotels
            </div>
            <div className="space-y-0.5">
              <NavItem href="/admin/hotel-sellers" label="Hotel Sellers" icon={<Building2 className="h-4 w-4" />} moduleKey="hotel-sellers" isSuperAdmin={isSuper} permissions={permissions} />
              <NavItem href="/admin/hotels" label="Hotels" icon={<Building2 className="h-4 w-4" />} moduleKey="hotels" isSuperAdmin={isSuper} permissions={permissions} />
              <NavItem href="/admin/bookings" label="Hotel Bookings" icon={<Calendar className="h-4 w-4" />} moduleKey="bookings" isSuperAdmin={isSuper} permissions={permissions} />
            </div>
          </div>
        </>
      )}

      {/* ── RESTAURANTS SECTION ── */}
      {canSeeSection(["restaurant-sellers", "restaurant-foods", "restaurant-orders"]) && (
        <>
          <Separator className="bg-slate-200 dark:bg-slate-800 my-1" />
          <div>
            <div className="px-3 mb-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Restaurants
            </div>
            <div className="space-y-0.5">
              <NavItem href="/admin/restaurant-sellers" label="Restaurant Sellers" icon={<Briefcase className="h-4 w-4" />} moduleKey="restaurant-sellers" isSuperAdmin={isSuper} permissions={permissions} />
              <NavItem href="/admin/restaurant-foods" label="Food Items" icon={<Utensils className="h-4 w-4" />} moduleKey="restaurant-foods" isSuperAdmin={isSuper} permissions={permissions} />
              <NavItem href="/admin/restaurant-orders" label="Restaurant Orders" icon={<ShoppingCart className="h-4 w-4" />} moduleKey="restaurant-orders" isSuperAdmin={isSuper} permissions={permissions} />
            </div>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden md:block">
        <div className="flex items-center justify-center border-b px-6 py-4">
          <a href="/" className="flex w-full flex-col items-center gap-1.5 text-center">
            <Image src="/images/logo.png" alt="Logo" width={200} height={56} className="h-14 w-auto object-contain shrink-0" />
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-bold text-muted-foreground tracking-wide">Admin</span>
              <Badge
                variant="outline"
                className={`text-[9px] px-2 py-0.5 font-bold uppercase rounded-md ${
                  isSuper
                    ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                }`}
              >
                {user.roleName || (isSuper ? "Super Admin" : "Staff")}
              </Badge>
            </div>
          </a>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">{navContent}</nav>
        <div className="border-t p-4">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl font-bold"
            onClick={() => signOut({ redirect: false }).then(() => { window.location.href = isStaff ? "/backoffice/login" : "/" })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </Sidebar>

      <div className="flex flex-1 flex-col md:pl-64 min-w-0 max-w-full overflow-x-hidden">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-blue-900/20 bg-gradient-to-r from-blue-50 via-blue-200 to-cyan-600 px-6 shadow-md">
          <div className="flex flex-1 items-center gap-4">
            {mounted ? (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <div className="flex h-full flex-col pt-4">{navContent}</div>
                </SheetContent>
              </Sheet>
            ) : (
              <div className="h-10 w-10 md:hidden" />
            )}
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="hidden sm:inline-flex rounded-full px-3 py-1 font-bold text-xs bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border-white/40 shadow-sm"
            >
              {user.roleName || (isSuper ? "Super Admin" : "Staff")}
            </Badge>

            {mounted && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-white/50">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                      <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      {user.name && <p className="text-sm font-bold leading-none">{user.name}</p>}
                      {(user.email || user.phone) && <p className="text-xs leading-none text-muted-foreground">{user.email || user.phone}</p>}
                      <div className="pt-1">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                          Role: {user.roleName || (isSuper ? "Super Admin" : "Staff")}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ redirect: false }).then(() => { window.location.href = isStaff ? "/backoffice/login" : "/" })}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted" />
            )}
          </div>
        </header>

        <main className="flex-1 min-w-0 max-w-full overflow-x-hidden">
          {isUnauthorized ? (
            <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 flex items-center justify-center shadow-inner">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-black text-foreground tracking-tight">Access Restricted</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Your assigned backoffice role (<strong>{user.roleName || "Staff"}</strong>) does not have permission to view or manage this administrative module.
                </p>
              </div>
              <div className="pt-2">
                <Button asChild className="rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20">
                  <Link href={getFirstAllowedPath(permissions)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Go to Your Permitted Module
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
        <DashboardFooter panelName="Admin Portal" />
      </div>
    </div>
  )
}
