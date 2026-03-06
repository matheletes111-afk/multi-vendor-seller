"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/ui/sheet"
import { useCart } from "@/app/cart/cart-context"
import { UserRole } from "@prisma/client"
import { ChevronDown, LayoutGrid, Menu, Search, ShoppingCart, MapPin, Mail, Phone, Facebook, Twitter, Instagram, Linkedin, Youtube } from "lucide-react"
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
  /** Cart is only for guest or customer; hide for seller/admin */
  const canUseCart = status !== "authenticated" || session?.user?.role === UserRole.CUSTOMER

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
      <div className="container mx-auto flex min-h-14 items-center gap-2 px-3 py-2 sm:min-h-[3.5rem] sm:gap-4 sm:px-4 sm:py-0">
        <a href="/" className="flex shrink-0 items-center">
          <Image
            src="/images/logo.png"
            alt="Logo"
            width={120}
            height={36}
            className="h-8 w-auto object-contain sm:h-9"
            priority
          />
        </a>

        <form onSubmit={handleSearch} className="flex min-w-0 flex-1 max-w-xl">
          <div className="relative flex w-full min-w-0">
            {/* All dropdown - hidden on very small screens to save space */}
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="hidden h-9 shrink-0 rounded-r-none border-amber-400 bg-slate-50 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:ring-amber-500 sm:flex sm:h-10 sm:px-3 sm:text-sm"
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
              className="min-w-0 rounded-l-md border-l border-amber-400 border-r-0 bg-white text-sm focus-visible:ring-amber-500 sm:rounded-l-none sm:border-l-0 sm:text-base"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-l-none border border-l-0 border-amber-400 bg-amber-400 text-black hover:bg-amber-500 sm:h-10 sm:w-10">
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sr-only">Search</span>
            </Button>
          </div>
        </form>

        <nav className="ml-1 flex shrink-0 items-center gap-0 sm:ml-auto sm:gap-1 md:gap-3">
          {/* Mobile menu – only render Sheet after mount to avoid Radix ID hydration mismatch */}
          <div className="flex items-center md:hidden">
            {mounted ? (
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-white hover:bg-slate-600/50 hover:text-white sm:h-10 sm:w-10"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(320px,100vw)] overflow-y-auto bg-white p-0">
                <SheetHeader className="border-b border-slate-200 p-4 text-left">
                  <SheetTitle className="text-slate-800">Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col py-2">
                  <Link href="/browse" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100">
                    <LayoutGrid className="h-4 w-4" />
                    All Departments
                  </Link>
                  {categories.map((cat) => (
                    <div key={cat.id}>
                      <Link href={`/browse?categoryId=${cat.id}`} className="flex px-4 py-2.5 pl-8 text-sm text-slate-700 hover:bg-slate-100">
                        {cat.name}
                      </Link>
                      {cat.subcategories.map((sub) => (
                        <Link href={`/browse?subcategoryId=${sub.id}`} key={sub.id} className="flex px-4 py-2 pl-12 text-sm text-slate-600 hover:bg-slate-100">
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  ))}
                  <div className="my-2 border-t border-slate-200" />
                  {showBecomePartner && (
                    <>
                      <Link href="/product-seller/login" className="px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100">
                        Product Seller Login
                      </Link>
                      <Link href="/service-seller/login" className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                        Service Seller Login
                      </Link>
                      <div className="my-2 border-t border-slate-200" />
                    </>
                  )}
                  {isLoggedIn ? (
                    <Link href="/dashboard" className="px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100">
                      Dashboard
                    </Link>
                  ) : (
                    <>
                      <Link href="/customer/login" className="px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100">
                        Customer Login
                      </Link>
                      <Link href="/customer/registration" className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                        Customer Registration
                      </Link>
                    </>
                  )}
                  <Link href="/browse" className="px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">
                    Returns & Orders
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white hover:bg-slate-600/50 hover:text-white sm:h-10 sm:w-10"
                aria-label="Open menu"
                aria-hidden
              >
                <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            )}
          </div>

          {/* Desktop nav - hidden on mobile (menu is in sheet) */}
          <div className="hidden md:flex md:items-center md:gap-2 lg:gap-3">
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
                        Customer
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
                    Customer
                    <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                  </span>
                </Link>
              )}
            </>
          )}

          <Link
            href="/browse"
            className="flex flex-col items-start rounded px-2 py-1.5 text-white hover:opacity-90"
            aria-label="Returns and Orders"
          >
            <span className="text-xs text-blue-100">Returns</span>
            <span className="font-semibold">& Orders</span>
          </Link>
          </div>

          {canUseCart && (
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
          )}
        </nav>
      </div>
    </header>
  )
}

type FooterCategory = { id: string; name: string; slug: string }

export function SiteFooter() {
  const { data: session, status } = useSession()
  const isLoggedIn = status === "authenticated" && !!session?.user
  const canUseCart = status !== "authenticated" || session?.user?.role === UserRole.CUSTOMER
  const [categories, setCategories] = useState<FooterCategory[]>([])

  useEffect(() => {
    fetch("/api/home/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: FooterCategory[]) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
  }, [])

  const categoriesCol1 = categories.slice(0, 5)
  const categoriesCol2 = categories.slice(5, 10)

  const linkClass = "text-sm text-slate-700 transition-colors hover:text-slate-900 hover:underline"
  const headingClass = "mb-3 text-sm font-semibold uppercase tracking-wider text-slate-800 sm:mb-4"

  return (
    <footer className="border-t border-blue-900/20 bg-gradient-to-r from-blue-50 via-blue-200 to-cyan-600 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-6 lg:grid-cols-[1fr_1fr_1fr_auto] lg:gap-8 lg:items-start">
          {/* Quick Links */}
          <nav aria-label="Quick links" className="min-w-0">
            <p className={headingClass}>Quick Links</p>
            <ul className="flex flex-col gap-1.5">
              <li><Link href="/" className={linkClass}>Home</Link></li>
              <li><Link href="/browse" className={linkClass}>Browse</Link></li>
              {canUseCart && <li><Link href="/cart" className={linkClass}>Cart</Link></li>}
              {isLoggedIn ? (
                <>
                  <li><Link href="/dashboard" className={linkClass}>Dashboard</Link></li>
                  <li>
                    <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className={`${linkClass} cursor-pointer border-0 bg-transparent p-0 text-left`}>
                      Logout
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li><Link href="/customer/login" className={linkClass}>Customer Login</Link></li>
                  <li><Link href="/product-seller/login" className={linkClass}>Product Seller Login</Link></li>
                  <li><Link href="/service-seller/login" className={linkClass}>Service Seller Login</Link></li>
                </>
              )}
            </ul>
          </nav>

          {/* Browse by Category */}
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <p className={headingClass}>Browse by Category</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:gap-x-6">
              <ul className="flex flex-col gap-1.5">
                {categoriesCol1.map((cat) => (
                  <li key={cat.id}>
                    <Link href={`/browse?categoryId=${cat.id}`} className={linkClass}>{cat.name}</Link>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-1.5">
                {categoriesCol2.map((cat) => (
                  <li key={cat.id}>
                    <Link href={`/browse?categoryId=${cat.id}`} className={linkClass}>{cat.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Contact Us – address row has logo on the right; column auto-sized to avoid blank space */}
          <div className="min-w-0 w-full max-w-sm lg:max-w-none lg:w-auto">
            <p className={headingClass}>Contact Us</p>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 text-sm text-slate-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                  <span className="break-words">123 Market St, Suite 100, City, State 12345, USA</span>
                </div>
              </div>
              <a href="/" className="mt-2 ml-14 shrink-0 sm:mt-3 sm:ml-14" aria-label="MEEEM home">
                <Image src="/images/logo.png" alt="MEEEM" width={150} height={45} className="h-12 w-auto object-contain sm:h-14" />
              </a>
            </div>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-slate-600" />
                <a href="mailto:info@example.com" className="truncate hover:text-slate-900 hover:underline">info@example.com</a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-slate-600" />
                <a href="tel:+13025550123" className="hover:text-slate-900 hover:underline">+1 (302) 555-0123</a>
              </li>
            </ul>
            <div className="mt-3 flex gap-2">
              <a href="#" aria-label="Facebook" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm transition-colors hover:bg-white hover:shadow sm:h-9 sm:w-9">
                <Facebook className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </a>
              <a href="#" aria-label="Twitter" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm transition-colors hover:bg-white hover:shadow sm:h-9 sm:w-9">
                <Twitter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </a>
              <a href="#" aria-label="Instagram" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm transition-colors hover:bg-white hover:shadow sm:h-9 sm:w-9">
                <Instagram className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </a>
              <a href="#" aria-label="LinkedIn" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm transition-colors hover:bg-white hover:shadow sm:h-9 sm:w-9">
                <Linkedin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </a>
              <a href="#" aria-label="YouTube" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm transition-colors hover:bg-white hover:shadow sm:h-9 sm:w-9">
                <Youtube className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Copyright row */}
        <div className="mt-6 flex justify-center border-t border-blue-900/20 pt-4 sm:mt-7 sm:pt-5">
          <p className="text-center text-xs text-slate-600">
            © {new Date().getFullYear()} MEEEM Marketplace. All rights reserved.
          </p>
        </div>
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
