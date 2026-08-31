"use client"

import React, { ReactNode, useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Package,
  Wallet,
  Settings,
  LogOut,
  Menu,
  Bike,
  MapPin,
  User,
  ShieldAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import { Button } from "@/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { DashboardFooter } from "@/components/layout/dashboard-footer"
import { DeviceTokenListener } from "./components/device-token-listener"
import { RiderLocationStreamer } from "./components/rider-location-streamer"

function NavItem({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== "/riderapp" && pathname?.startsWith(`${href}/`))

  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all select-none",
        isActive
          ? "bg-blue-600 text-white shadow-xs font-semibold"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </Link>
  )
}

export function RiderLayoutClient({
  children,
  user,
}: {
  children: ReactNode
  user: any
}) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => setMounted(true), [])

  const isAuthOrOnboarding =
    pathname?.startsWith("/riderapp/login") ||
    pathname?.startsWith("/riderapp/registration") ||
    pathname?.startsWith("/riderapp/verify-email") ||
    pathname?.startsWith("/riderapp/forgot-password") ||
    pathname?.startsWith("/riderapp/reset-password") ||
    pathname?.startsWith("/riderapp/onboarding")

  if (isAuthOrOnboarding || !user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
        <main className="flex-1">{children}</main>
      </div>
    )
  }

  const userInitials =
    user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ||
    user?.email?.[0].toUpperCase() ||
    "R"

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Logo & Portal Badge */}
        <div className="flex items-center justify-between px-2">
          <Link href="/riderapp" className="flex items-center gap-2.5">
            <Image
              src="/images/logo.png"
              alt="MEEEM"
              width={120}
              height={36}
              className="h-8 w-auto object-contain dark:brightness-200"
            />
            <span className="text-[11px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Rider
            </span>
          </Link>
        </div>

        {/* Navigation Items */}
        <div className="space-y-1">
          <div className="px-3 mb-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Menu
          </div>
          <NavItem href="/riderapp" label="Dashboard" icon={<LayoutDashboard className="w-4 h-4" />} />
          <NavItem href="/riderapp/orders" label="Delivery Orders" icon={<Package className="w-4 h-4" />} />
          <NavItem href="/riderapp/revenue" label="My Revenue" icon={<Wallet className="w-4 h-4" />} />
          <NavItem href="/riderapp/settings" label="Settings & Profile" icon={<Settings className="w-4 h-4" />} />
        </div>
      </div>

      {/* User Card at bottom of sidebar */}
      <div className="pt-4 border-t border-border/80">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-muted/40">
          <Avatar className="h-9 w-9 border shrink-0">
            <AvatarImage src={user?.image || ""} alt={user?.name || "Rider"} />
            <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-foreground truncate">
              {user?.name || "Delivery Rider"}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <DeviceTokenListener />
      <RiderLocationStreamer />

      {/* Desktop Fixed Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden md:block h-screen w-64 border-r border-border bg-card">
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 bg-card">
                {sidebarContent}
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                <Bike className="w-5 h-5 text-blue-600" />
                Rider Portal
              </span>
            </div>
          </div>

          {/* Top Right Profile & Logout */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-full p-1 hover:bg-muted transition-colors focus:outline-none">
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={user?.image || ""} alt={user?.name || "Rider"} />
                    <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-xs font-semibold text-foreground max-w-[120px] truncate">
                    {user?.name || user?.email}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5 shadow-lg">
                <DropdownMenuLabel className="px-3 py-2">
                  <div className="text-xs font-bold text-foreground">{user?.name || "Rider"}</div>
                  <div className="text-[11px] text-muted-foreground font-normal truncate">
                    {user?.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                  <Link href="/riderapp/settings" className="flex items-center gap-2 text-xs">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    Account Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/riderapp/login" })}
                  className="rounded-xl text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer text-xs flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Children */}
        <main className="flex-1">{children}</main>

        {/* Dashboard Footer */}
        <DashboardFooter />
      </div>
    </div>
  )
}
