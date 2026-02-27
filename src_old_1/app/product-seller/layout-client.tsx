"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ReactNode, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { signOut } from "next-auth/react"
import { ThemeToggle } from "@/ui/theme-toggle"
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
import { Sheet, SheetContent, SheetTrigger } from "@/ui/sheet"
import { LogOut, User, LayoutDashboard, Package, ShoppingCart, CreditCard, Settings, Menu, Megaphone } from "lucide-react"

function NavItem({ href, label, icon }: { href: string; label: string; icon?: ReactNode }) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname?.startsWith(`${href}/`)
  return (
    <Link href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
      {icon && <span className="h-4 w-4">{icon}</span>}
      <span className="flex-1">{label}</span>
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

const navContent = (
  <>
    <NavItem href="/product-seller" label="Overview" icon={<LayoutDashboard className="h-4 w-4" />} />
    <NavItem href="/product-seller/products" label="Products" icon={<Package className="h-4 w-4" />} />
    <NavItem href="/product-seller/admanagement" label="Ads" icon={<Megaphone className="h-4 w-4" />} />
    <NavItem href="/product-seller/orders" label="Orders" icon={<ShoppingCart className="h-4 w-4" />} />
    <NavItem href="/product-seller/subscription" label="Subscription" icon={<CreditCard className="h-4 w-4" />} />
    <NavItem href="/product-seller/settings" label="Settings" icon={<Settings className="h-4 w-4" />} />
  </>
)

export function ProductSellerLayoutClient({
  children,
  user,
}: {
  children: ReactNode
  user: { name?: string | null; email?: string | null; image?: string | null }
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const userInitials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || user?.email?.[0].toUpperCase() || "U"
  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden md:block">
        <div className="flex items-center justify-center border-b px-6 py-4">
          <Link href="/" className="flex w-full flex-col items-center gap-1.5 text-center">
            <Image src="/images/logo-three.jpeg" alt="Logo" width={200} height={56} className="h-14 w-auto object-contain shrink-0" />
            <span className="text-xs font-medium text-muted-foreground tracking-wide">Product Seller</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">{navContent}</nav>
        <div className="border-t p-4">
          <Button type="button" variant="outline" className="w-full" onClick={() => signOut({ callbackUrl: "/" })}>Logout</Button>
        </div>
      </Sidebar>
      <div className="flex flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {mounted && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                      <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      {user.name && <p className="text-sm font-medium leading-none">{user.name}</p>}
                      {user.email && <p className="text-xs leading-none text-muted-foreground">{user.email}</p>}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/product-seller/settings"><User className="mr-2 h-4 w-4" /><span>Profile</span></Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                    <LogOut className="mr-2 h-4 w-4" /><span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted" />
            )}
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
