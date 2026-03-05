"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { ThemeToggle } from "@/ui/theme-toggle"
import { useCart } from "@/contexts/cart-context"
import { ChevronDown, LayoutGrid, Search, ShoppingCart } from "lucide-react"
import { ReactNode } from "react"

const PAGE_BACKGROUND = "bg-gradient-to-b from-violet-300 via-purple-100 to-pink-100"

type Subcategory = { id: string; name: string; slug: string; image: string | null }
type Category = { id: string; name: string; slug: string; subcategories: Subcategory[] }

export function SiteHeader() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { totalItems } = useCart()
  const [searchQuery, setSearchQuery] = useState("")
  const [mounted, setMounted] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const isLoggedIn = status === "authenticated" && !!session?.user
  const showBecomePartner = !isLoggedIn

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    fetch("/api/home/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push("/browse")
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-blue-900/20 bg-gradient-to-r from-blue-50 via-blue-200 to-cyan-600 shadow-md">
      <div className="container mx-auto flex h-12 min-h-12 items-center gap-2 px-2 sm:h-14 sm:gap-4 sm:px-4">
        <a href="/" className="flex shrink-0 items-center">
          <Image
            src="/images/logo.png"
            alt="Logo"
            width={120}
            height={36}
            className="h-7 w-auto object-contain sm:h-9"
            priority
          />
        </a>

        <form onSubmit={handleSearch} className="flex min-w-0 flex-1 max-w-xl">
          <div className="relative flex w-full min-w-0">
            {/* All dropdown beside search - only mount Radix after hydration to avoid id mismatch */}
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0 rounded-r-none border-amber-400 bg-slate-50 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:ring-amber-500 sm:h-10 sm:px-3 sm:text-sm"
                  >
                    <LayoutGrid className="mr-1 h-3.5 w-3.5 sm:mr-1.5 sm:h-4 sm:w-4" />
                    All
                    <ChevronDown className="ml-0.5 h-3.5 w-3.5 sm:ml-1 sm:h-4 sm:w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[70vh] w-56 overflow-y-auto p-0">
                  <DropdownMenuItem asChild>
                    <Link href="/browse" className="flex items-center gap-2 font-medium">
                      <LayoutGrid className="h-4 w-4" />
                      All Departments
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {categories.map((cat) => (
                    <div key={cat.id}>
                      <DropdownMenuItem asChild>
                        <Link href={`/browse?categoryId=${cat.id}`} className="font-medium">
                          {cat.name}
                        </Link>
                      </DropdownMenuItem>
                      {cat.subcategories.map((sub) => (
                        <DropdownMenuItem asChild key={sub.id}>
                          <Link href={`/browse?subcategoryId=${sub.id}`} className="pl-6 text-sm text-slate-600">
                            {sub.name}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 rounded-r-none border-amber-400 bg-slate-50 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:ring-amber-500"
                aria-hidden
              >
                <LayoutGrid className="mr-1.5 h-4 w-4" />
                All
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            )}
            <Input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-0 rounded-none border-l-0 border-r-0 border-amber-400 bg-white text-sm focus-visible:ring-amber-500 sm:text-base"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-l-none border border-l-0 border-amber-400 bg-amber-400 text-black hover:bg-amber-500 sm:h-10 sm:w-10">
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sr-only">Search</span>
            </Button>
          </div>
        </form>

        <nav className="ml-1 flex shrink-0 items-center gap-0 sm:ml-auto sm:gap-1 md:gap-3">
          <span className="[&_button]:text-blue-100 [&_button]:hover:bg-slate-600/50 [&_button]:hover:text-white [&_button]:rounded [&_button]:p-1.5 sm:[&_button]:p-2">
            <ThemeToggle />
          </span>

          {mounted ? (
            <>
              {showBecomePartner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="flex items-center rounded px-2 py-1.5 text-left text-sm font-medium text-white hover:bg-slate-600/50 hover:outline-none focus:outline-none sm:px-3">
                      Become a partner
                      <ChevronDown className="ml-1 h-4 w-4 shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem asChild>
                      <Link href="/product-seller/login">Product Seller Login</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/service-seller/login">Service Seller Login</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="flex flex-col items-start rounded px-1.5 py-1 text-left text-white hover:bg-slate-600/50 hover:outline-none focus:outline-none sm:px-2 sm:py-1.5"
                >
                  <span className="text-xs font-semibold leading-tight sm:text-sm">Dashboard</span>
                </Link>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="flex flex-col items-start rounded px-1.5 py-1 text-left text-white hover:outline-none focus:outline-none sm:px-2 sm:py-1.5">
                      <span className="text-[10px] text-blue-100 sm:text-xs">Hello, sign in</span>
                      <span className="flex items-center text-xs font-semibold leading-tight sm:text-sm">
                        <span className="hidden sm:inline">Customer</span>
                        <span className="sm:hidden">Account</span>
                        <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link href="/customer/login">Customer Login</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/customer/registration">Customer Registration</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          ) : (
            <>
              {showBecomePartner && (
                <Link href="/product-seller/login" className="rounded px-2 py-1.5 text-sm font-medium text-white hover:bg-slate-600/50 sm:px-3">
                  Become a partner
                </Link>
              )}
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="flex flex-col items-start rounded px-1.5 py-1 text-left text-white hover:opacity-90 sm:px-2 sm:py-1.5"
                >
                  <span className="text-xs font-semibold leading-tight sm:text-sm">Dashboard</span>
                </Link>
              ) : (
                <Link
                  href="/customer/login"
                  className="flex flex-col items-start rounded px-1.5 py-1 text-left text-white hover:opacity-90 sm:px-2 sm:py-1.5"
                >
                  <span className="text-[10px] text-blue-100 sm:text-xs">Hello, sign in</span>
                  <span className="flex items-center text-xs font-semibold leading-tight sm:text-sm">
                    <span className="hidden sm:inline">Customer</span>
                    <span className="sm:hidden">Account</span>
                    <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                  </span>
                </Link>
              )}
            </>
          )}

          <Link
            href="/browse"
            className="hidden flex-col items-start rounded px-2 py-1.5 text-white hover:opacity-90 md:flex"
            aria-label="Returns and Orders"
          >
            <span className="text-xs text-blue-100">Returns</span>
            <span className="font-semibold">& Orders</span>
          </Link>

          <Link
            href="/cart"
            className="relative flex items-center gap-0.5 rounded p-1.5 text-white hover:opacity-90 sm:gap-1 sm:px-2 sm:py-1.5"
            aria-label={`Cart, ${totalItems} items`}
          >
            <span className="relative">
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold text-black sm:-right-2 sm:-top-2 sm:h-4 sm:min-w-4 sm:px-1 sm:text-[10px]">
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
  const { data: session, status } = useSession()
  const isLoggedIn = status === "authenticated" && !!session?.user

  return (
    <footer className="border-t border-blue-200/80 bg-gradient-to-br from-blue-50 via-sky-100 to-blue-200">
      <div className="container mx-auto px-4 py-5">
        <div className="flex flex-row items-start justify-between gap-6">
          <nav className="py-1" aria-label="Quick links">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-blue-900/70 sm:text-xs">
              Quick Links
            </p>
            {isLoggedIn ? (
              <ul className="flex flex-col gap-1.5">
                <li>
                  <Link href="/dashboard" className="text-sm font-medium text-blue-900 transition-colors hover:text-blue-700 sm:text-base">
                    Dashboard
                  </Link>
                </li>
              </ul>
            ) : (
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-blue-900/90 sm:gap-x-8">
                <li><Link href="/admin/login" className="transition-colors hover:text-blue-700 hover:underline">Admin Login</Link></li>
                <li><Link href="/service-seller/registration" className="transition-colors hover:text-blue-700 hover:underline">Service Seller Registration</Link></li>
                <li><Link href="/service-seller/login" className="transition-colors hover:text-blue-700 hover:underline">Service Seller Login</Link></li>
                <li><Link href="/product-seller/registration" className="transition-colors hover:text-blue-700 hover:underline">Product Seller Registration</Link></li>
                <li><Link href="/product-seller/login" className="transition-colors hover:text-blue-700 hover:underline">Product Seller Login</Link></li>
                <li><Link href="/customer/registration" className="transition-colors hover:text-blue-700 hover:underline">Customer Registration</Link></li>
                <li><Link href="/customer/login" className="transition-colors hover:text-blue-700 hover:underline">Customer Login</Link></li>
              </ul>
            )}
          </nav>
          <a href="/" className="flex shrink-0 items-center">
            <Image src="/images/logo.png" alt="MEEEM" width={140} height={40} className="h-10 w-auto object-contain sm:h-12" />
          </a>
        </div>
        <p className="mt-4 border-t border-blue-200/60 pt-4 text-center text-xs text-blue-900/50 sm:text-left sm:text-sm">
          © {new Date().getFullYear()} MEEEM Marketplace. All rights reserved.
        </p>
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
