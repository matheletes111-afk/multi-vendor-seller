"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { ThemeToggle } from "@/ui/theme-toggle"
import { useCart } from "@/contexts/cart-context"
import { ChevronDown, Search, ShoppingCart } from "lucide-react"
import { ReactNode } from "react"

const PAGE_BACKGROUND = "bg-gradient-to-b from-violet-300 via-purple-100 to-pink-100"

export function SiteHeader() {
  const router = useRouter()
  const { totalItems } = useCart()
  const [searchQuery, setSearchQuery] = useState("")
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/customer/browse?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push("/customer/browse")
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-blue-900/20 bg-gradient-to-r from-blue-800 via-blue-700 to-cyan-600 shadow-md">
      <div className="container mx-auto flex h-14 items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/images/logo-three.jpeg"
            alt="Logo"
            width={120}
            height={36}
            className="h-9 w-auto object-contain"
            priority
          />
        </Link>

        <form onSubmit={handleSearch} className="flex flex-1 max-w-xl">
          <div className="relative flex w-full">
            <Input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 rounded-r-none border-r-0 border-amber-400 bg-white focus-visible:ring-amber-500"
            />
            <Button type="submit" size="icon" className="rounded-l-none border border-l-0 border-amber-400 bg-amber-400 text-black hover:bg-amber-500">
              <Search className="h-4 w-4" />
              <span className="sr-only">Search</span>
            </Button>
          </div>
        </form>

        <nav className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
          <span className="[&_button]:text-blue-100 [&_button]:hover:bg-slate-600/50 [&_button]:hover:text-white">
            <ThemeToggle />
          </span>

          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex flex-col items-start rounded px-2 py-1.5 text-left text-white hover:outline-none focus:outline-none">
                  <span className="text-xs text-blue-100">Hello, sign in</span>
                  <span className="flex items-center font-semibold">
                    Account & Lists
                    <ChevronDown className="ml-0.5 h-4 w-4" />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/login">Login</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/register">Sign up</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className="flex flex-col items-start rounded px-2 py-1.5 text-left text-white hover:opacity-90"
            >
              <span className="text-xs text-blue-100">Hello, sign in</span>
              <span className="flex items-center font-semibold">
                Account & Lists
                <ChevronDown className="ml-0.5 h-4 w-4" />
              </span>
            </Link>
          )}

          <Link
            href="/customer/browse"
            className="flex flex-col items-start rounded px-2 py-1.5 text-white hover:opacity-90"
          >
            <span className="text-xs text-blue-100">Returns</span>
            <span className="font-semibold">& Orders</span>
          </Link>

          <Link
            href="/cart"
            className="relative flex items-center gap-1 rounded px-2 py-1.5 text-white hover:opacity-90"
            aria-label="Cart"
          >
            <span className="relative">
              <ShoppingCart className="h-6 w-6" />
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            </span>
            <span className="hidden font-semibold sm:inline">Cart</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-blue-900/20 bg-gradient-to-r from-blue-800 via-blue-700 to-cyan-600">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
        <Link href="/" className="flex items-center">
          <Image src="/images/logo-three.jpeg" alt="Logo" width={100} height={28} className="h-7 w-auto object-contain" />
        </Link>
        <p className="text-sm text-blue-100">© {new Date().getFullYear()} MEEEM Marketplace. All rights reserved.</p>
      </div>
    </footer>
  )
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`flex min-h-screen flex-col text-foreground ${PAGE_BACKGROUND}`}>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}

export { PAGE_BACKGROUND }
