"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { formatCurrency, cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/ui/sheet"
import { useCart } from "@/app/cart/cart-context"
import { useWishlist } from "@/app/wishlist/wishlist-context"
import { UserRole } from "@prisma/client"
import { ChevronDown, ChevronRight, Heart, LayoutGrid, Menu, Package, Search, ShoppingCart, Trash2, MapPin, Mail, Phone, Facebook, Twitter, Instagram, Linkedin, Youtube, User } from "lucide-react"
import { ReactNode } from "react"

const PAGE_BACKGROUND = "bg-gradient-to-b from-violet-300 via-purple-100 to-pink-100"

type Subcategory = { id: string; name: string; slug: string; image: string | null }
type Category = { id: string; name: string; slug: string; subcategories: Subcategory[] }
type ServiceCategory = { id: string; name: string; slug: string }

export function SiteHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const isFoodSection = pathname?.startsWith("/foods")
  const isHotelSection = pathname?.startsWith("/hotels")
  const isServiceSection = pathname?.startsWith("/service")
  const isCustomNav = isFoodSection || isHotelSection || isServiceSection
  const { data: session, status } = useSession()
  const { totalItems } = useCart()
  const { count: wishlistCount, items: wishlistItems, canUseWishlist, removeWishlist } = useWishlist()
  const [searchQuery, setSearchQuery] = useState("")
  const [mounted, setMounted] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([])
  const isLoggedIn = status === "authenticated" && !!session?.user
  const showOrdersLink = status === "authenticated" && session?.user?.role === UserRole.CUSTOMER
  const showBecomePartner = !isLoggedIn
  /** Cart is only for guest or customer; hide for seller/admin */
  const canUseCart = status !== "authenticated" || session?.user?.role === UserRole.CUSTOMER
  const topWishlistItems = wishlistItems.slice(0, 6)

  const userInitials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ||
    session?.user?.email?.[0]?.toUpperCase() ||
    "U"

  const profileHref =
    session?.user?.role === UserRole.CUSTOMER
      ? "/customer/settings"
      : session?.user?.role === UserRole.SELLER_PRODUCT
        ? "/product-seller/settings"
        : session?.user?.role === UserRole.SELLER_SERVICE
          ? "/service-seller/settings"
          : "/dashboard"

  const profileLabel =
    session?.user?.role === UserRole.CUSTOMER
      ? "Profile"
      : session?.user?.role === UserRole.SELLER_PRODUCT
        ? "Profile"
        : session?.user?.role === UserRole.SELLER_SERVICE
          ? "Profile"
          : "Profile"

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    Promise.all([
      fetch("/api/home/categories").then((r) => (r.ok ? r.json() : [])),
      fetch("/mobileapi/services/categories?activeOnly=true").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([productCats, serviceResp]) => {
        setCategories(Array.isArray(productCats) ? productCats : [])
        const list = serviceResp?.success && Array.isArray(serviceResp?.data?.categories)
          ? serviceResp.data.categories
          : []
        setServiceCategories(list)
      })
      .catch(() => {
        setCategories([])
        setServiceCategories([])
      })
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
    <header className={
      isFoodSection 
        ? "sticky top-0 z-50 border-b border-[#F5EFE6] bg-[#FDFBF7] text-amber-950 shadow-sm" 
        : isHotelSection
          ? "sticky top-0 z-50 border-b border-emerald-200 bg-gradient-to-r from-emerald-100 via-green-100 to-teal-100 text-emerald-950 shadow-xs"
          : "sticky top-0 z-50 border-b border-blue-900/20 bg-gradient-to-r from-blue-50 via-blue-200 to-cyan-600 shadow-md"
    }>
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

        {!isCustomNav && (
          <form onSubmit={handleSearch} className="flex min-w-0 flex-1 max-w-xl items-center">
            <div className="relative flex w-full min-w-0 items-center">
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
                        All Category
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
                placeholder="Search products or 'Product, Shop'..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 min-w-0 rounded-l-md border-l border-amber-400 border-r-0 bg-white py-2 text-sm focus-visible:ring-amber-500 sm:h-10 sm:rounded-l-none sm:border-l-0 sm:text-base"
              />
              <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-l-none border border-l-0 border-amber-400 bg-amber-400 text-black hover:bg-amber-500 sm:h-10 sm:w-10">
                <Search className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <span className="sr-only">Search</span>
              </Button>
            </div>
          </form>
        )}

        <nav className="ml-auto flex shrink-0 items-center gap-0 sm:gap-1 md:gap-3">
          {/* Mobile menu – only render Sheet after mount to avoid Radix ID hydration mismatch */}
          <div className="flex items-center md:hidden">
            {mounted ? (
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-9 w-9 sm:h-10 sm:w-10 font-bold",
                      isFoodSection 
                        ? "text-amber-950 hover:bg-amber-950/10" 
                        : isHotelSection
                          ? "text-emerald-950 hover:bg-emerald-950/10"
                          : "text-slate-900 hover:bg-slate-900/10"
                    )}
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[min(340px,100vw)] overflow-y-auto bg-slate-50 p-0 border-l border-slate-200/80 shadow-2xl">
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4 pr-12">
                    <div className="flex items-center gap-2">
                      <Image
                        src="/images/logo.png"
                        alt="Logo"
                        width={100}
                        height={30}
                        className="h-7 w-auto object-contain"
                      />
                    </div>
                    <SheetTitle className="text-xs font-black uppercase tracking-wider text-slate-400">Menu</SheetTitle>
                  </div>

                  <div className="flex flex-col p-4 space-y-5">
                    {/* 1. Core System Panels */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">System Portals</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href="/"
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all",
                            (pathname === "/" || pathname === "/browse")
                              ? "border-slate-900 bg-slate-900 text-white shadow-md font-bold"
                              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100 font-semibold"
                          )}
                        >
                          <span className="text-xl mb-1">🛍️</span>
                          <span className="text-xs">Marketplace</span>
                        </Link>

                        <Link
                          href="/service"
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all",
                            pathname?.startsWith("/service")
                              ? "border-amber-400 bg-amber-400 text-slate-950 shadow-md font-bold"
                              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100 font-semibold"
                          )}
                        >
                          <span className="text-xl mb-1">🛠️</span>
                          <span className="text-xs">Services</span>
                        </Link>

                        <Link
                          href="/hotels"
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all",
                            pathname?.startsWith("/hotels")
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-md font-bold"
                              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100 font-semibold"
                          )}
                        >
                          <span className="text-xl mb-1">🏨</span>
                          <span className="text-xs">Hotels</span>
                        </Link>

                        <Link
                          href="/foods"
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all",
                            pathname?.startsWith("/foods")
                              ? "border-orange-600 bg-orange-600 text-white shadow-md font-bold"
                              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100 font-semibold"
                          )}
                        >
                          <span className="text-xl mb-1">🍔</span>
                          <span className="text-xs">Restaurants</span>
                        </Link>
                      </div>
                    </div>

                    {/* 2. Customer Actions */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Account & Activity</p>
                      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden divide-y divide-slate-100 shadow-2xs">
                        {isLoggedIn ? (
                          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-800 hover:bg-slate-50">
                            <User className="h-4 w-4 text-amber-600" />
                            Customer Dashboard
                          </Link>
                        ) : (
                          <>
                            <Link href="/customer/login" className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-800 hover:bg-slate-50">
                              <User className="h-4 w-4 text-amber-600" />
                              Customer Login
                            </Link>
                            <Link href="/customer/registration" className="flex items-center gap-3 px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                              <User className="h-4 w-4 text-slate-400" />
                              Create Account
                            </Link>
                          </>
                        )}
                        {showOrdersLink && (
                          <Link
                            href={
                              isFoodSection
                                ? "/customer/food-orders"
                                : pathname?.startsWith("/hotels")
                                ? "/customer/hotel-bookings"
                                : "/my-orders"
                            }
                            className="flex items-center gap-3 px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Package className="h-4 w-4 text-amber-600" />
                            {pathname?.startsWith("/hotels") ? "My Hotel Bookings" : "My Orders"}
                          </Link>
                        )}
                        {canUseWishlist && (
                          <Link href="/browse" className="flex items-center gap-3 px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            <Heart className="h-4 w-4 text-rose-500" />
                            My Wishlist ({wishlistCount})
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* 3. Partner / Seller Login Portals */}
                    {showBecomePartner && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Partner & Seller Portals</p>
                        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white p-3 space-y-2 shadow-2xs">
                          <Link href="/product-seller/login" className="flex items-center justify-between px-3 py-2 rounded-xl bg-white text-xs font-bold text-slate-800 border border-slate-200/80 hover:border-amber-400 shadow-2xs">
                            <span>Product Seller Portal</span>
                            <span className="text-[10px] text-amber-700 font-extrabold bg-amber-100 px-2 py-0.5 rounded-md">Sell</span>
                          </Link>
                          <Link href="/service-seller/login" className="flex items-center justify-between px-3 py-2 rounded-xl bg-white text-xs font-bold text-slate-800 border border-slate-200/80 hover:border-amber-400 shadow-2xs">
                            <span>Service Provider Portal</span>
                            <span className="text-[10px] text-amber-700 font-extrabold bg-amber-100 px-2 py-0.5 rounded-md">Provide</span>
                          </Link>
                          <Link href="/hotel-seller/login" className="flex items-center justify-between px-3 py-2 rounded-xl bg-white text-xs font-bold text-slate-800 border border-slate-200/80 hover:border-amber-400 shadow-2xs">
                            <span>Hotel Partner Portal</span>
                            <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-2 py-0.5 rounded-md">Host</span>
                          </Link>
                          <Link href="/restaurant-seller/login" className="flex items-center justify-between px-3 py-2 rounded-xl bg-white text-xs font-bold text-slate-800 border border-slate-200/80 hover:border-amber-400 shadow-2xs">
                            <span>Restaurant Partner Portal</span>
                            <span className="text-[10px] text-orange-700 font-extrabold bg-orange-100 px-2 py-0.5 rounded-md">Food</span>
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* 4. Shop Categories (Only shown on Marketplace Panel) */}
                    {!isCustomNav && categories.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Shop Categories</p>
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-2 space-y-1 shadow-2xs">
                          {categories.map((cat) => (
                            <Link
                              key={cat.id}
                              href={`/browse?categoryId=${cat.id}`}
                              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              <span>{cat.name}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 sm:h-10 sm:w-10 font-bold",
                  isFoodSection 
                    ? "text-amber-950 hover:bg-amber-950/10" 
                    : isHotelSection
                      ? "text-emerald-950 hover:bg-emerald-950/10"
                      : "text-slate-900 hover:bg-slate-900/10"
                )}
                aria-label="Open menu"
                aria-hidden
              >
                <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            )}
          </div>

          {/* Mobile user menu (avatar + profile/logout) */}
          {mounted && isLoggedIn && (
            <div className="md:hidden order-50">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "relative h-9 w-9 rounded-full p-0",
                      isFoodSection 
                        ? "text-amber-950 hover:bg-amber-950/10" 
                        : isHotelSection
                          ? "text-emerald-950 hover:bg-emerald-950/10"
                          : "text-slate-900 hover:bg-slate-900/10"
                    )}
                    aria-label="Open profile"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || ""} />
                      <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      {session?.user?.name && <p className="text-sm font-medium leading-none">{session.user.name}</p>}
                      {session?.user?.email && <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={profileHref} className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{profileLabel}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      signOut({ redirect: false }).then(() => {
                        window.location.href = "/"
                      })
                    }
                  >
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Desktop nav - hidden on mobile (menu is in sheet) */}
          <div className="hidden md:flex md:items-center md:gap-2 lg:gap-3 order-50">
            {mounted ? (
              <>
                {(() => {
                  const isMarketActive = pathname === "/" || pathname === "/browse"
                  const isServiceActive = pathname?.startsWith("/service") ?? false
                  const isHotelActive = pathname?.startsWith("/hotels") ?? false
                  const isFoodActive = pathname?.startsWith("/foods") ?? false

                  const getNavLinkClass = (isActive: boolean) => {
                    if (isFoodSection) {
                      return cn(
                        "flex items-center rounded-xl px-3 py-1.5 text-sm transition-all duration-200 font-bold",
                        isActive
                          ? "bg-amber-950 text-amber-50 font-extrabold shadow-sm"
                          : "text-amber-950 hover:bg-amber-950/10"
                      )
                    }
                    if (isHotelSection) {
                      return cn(
                        "flex items-center rounded-xl px-3 py-1.5 text-sm transition-all duration-200 font-bold",
                        isActive
                          ? "bg-emerald-800 text-white font-extrabold shadow-sm"
                          : "text-emerald-950 hover:bg-emerald-950/10"
                      )
                    }
                    if (isServiceSection) {
                      return cn(
                        "flex items-center rounded-xl px-3 py-1.5 text-sm transition-all duration-200 font-bold",
                        isActive
                          ? "bg-amber-400 text-slate-950 font-extrabold shadow-md"
                          : "text-white hover:bg-white/15"
                      )
                    }
                    // Default / Marketplace Header
                    return cn(
                      "flex items-center rounded-xl px-3.5 py-1.5 text-sm transition-all duration-200 font-medium",
                      isActive
                        ? "bg-slate-900 text-white font-extrabold shadow-md ring-1 ring-slate-950/20"
                        : "text-white hover:bg-slate-600/50 hover:text-white font-semibold"
                    )
                  }

                  return (
                    <>
                      <Link href="/" className={getNavLinkClass(isMarketActive)}>
                        Marketplace
                      </Link>
                      <Link href="/service" className={getNavLinkClass(isServiceActive)}>
                        Services
                      </Link>
                      <Link href="/hotels" className={getNavLinkClass(isHotelActive)}>
                        Hotels
                      </Link>
                      <Link href="/foods" className={getNavLinkClass(isFoodActive)}>
                        Restaurants
                      </Link>
                    </>
                  )
                })()}

                {showBecomePartner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex items-center rounded-xl px-2.5 py-1.5 text-left text-sm font-medium transition-all sm:px-3",
                          isFoodSection
                            ? "text-amber-950 hover:bg-amber-950/10 font-semibold"
                            : isHotelSection
                              ? "text-emerald-950 hover:bg-emerald-950/10 font-semibold"
                              : "text-slate-900 hover:bg-slate-900/10 font-semibold"
                        )}
                      >
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
                      <DropdownMenuItem asChild>
                        <Link href="/hotel-seller/login">Hotel Seller Login</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/restaurant-seller/login">Restaurant Seller Login</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {isLoggedIn ? (
                  <Link
                    href="/dashboard"
                    className={cn(
                      "flex flex-col items-start rounded-xl px-1.5 py-1 text-left sm:px-2 sm:py-1.5 font-bold",
                      isFoodSection
                        ? "text-amber-950 hover:bg-amber-950/10"
                        : isHotelSection
                          ? "text-emerald-950 hover:bg-emerald-950/10"
                          : "text-slate-900 hover:bg-slate-900/10"
                    )}
                  >
                    <span className="text-xs font-semibold leading-tight sm:text-sm">Dashboard</span>
                  </Link>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex flex-col items-start rounded-xl px-1.5 py-1 text-left sm:px-2 sm:py-1.5 font-bold",
                          isFoodSection
                            ? "text-amber-950 hover:bg-amber-950/10"
                            : isHotelSection
                              ? "text-emerald-950 hover:bg-emerald-950/10"
                              : "text-slate-900 hover:bg-slate-900/10"
                        )}
                      >
                        <span className={cn("text-[10px] sm:text-xs font-medium", isFoodSection ? "text-amber-800" : isHotelSection ? "text-emerald-700" : "text-slate-700")}>Hello, sign in</span>
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
            ) : null}
          </div>

          {showOrdersLink && (
              <Link
                href={
                  isFoodSection
                    ? "/customer/food-orders"
                    : pathname?.startsWith("/hotels")
                    ? "/customer/hotel-bookings"
                    : "/my-orders"
                }
                className={cn(
                  "order-40 flex flex-col items-start rounded px-2 py-1.5 font-bold",
                  isFoodSection
                    ? "text-amber-950 hover:bg-amber-950/10"
                    : isHotelSection
                      ? "text-white hover:bg-white/20"
                      : "text-slate-900 hover:bg-slate-900/10"
                )}
                aria-label="Orders"
              >
                <span className="font-semibold">{pathname?.startsWith("/hotels") ? "Bookings" : "Orders"}</span>
              </Link>
            )}

          {canUseCart && !isCustomNav && (
            <Link
              href="/cart"
              className={cn(
                "order-30 relative flex items-center gap-0.5 rounded p-1.5 sm:gap-1 sm:px-2 sm:py-1.5 font-bold",
                isFoodSection
                  ? "text-amber-950 hover:bg-amber-950/10"
                  : isHotelSection
                    ? "text-white hover:bg-white/20"
                    : "text-slate-900 hover:bg-slate-900/10"
              )}
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

          {canUseWishlist && !isCustomNav && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "order-35 relative inline-flex h-9 items-center justify-center gap-1 rounded px-1.5 sm:h-10 sm:px-2 font-bold",
                    isFoodSection
                      ? "text-amber-950 hover:bg-amber-950/10"
                      : isHotelSection
                        ? "text-white hover:bg-white/20"
                        : "text-slate-900 hover:bg-slate-900/10"
                  )}
                  aria-label={`Wishlist, ${wishlistCount} items`}
                >
                  <span className="relative">
                    <Heart className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                    <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-400 px-0.5 text-[9px] font-bold text-black sm:-right-2 sm:-top-2 sm:h-4 sm:min-w-4 sm:px-1 sm:text-[10px]">
                      {wishlistCount > 99 ? "99+" : wishlistCount}
                    </span>
                  </span>
                  <span className="hidden font-semibold sm:inline">Wishlist</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[92vw] max-w-sm p-0 sm:w-80">
                <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
                  <span>My Wishlist</span>
                  <span className="text-xs text-slate-500">{wishlistCount} item{wishlistCount === 1 ? "" : "s"}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {status === "unauthenticated" && wishlistCount > 0 && (
                  <div className="m-2 rounded-xl bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 border border-sky-200/80 p-3 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <div className="rounded-lg bg-rose-100 p-1.5 text-rose-500 shrink-0 mt-0.5 shadow-xs">
                        <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-sky-950 leading-tight">
                          Save your wishlist
                        </p>
                        <p className="text-[11px] text-sky-800 mt-0.5 leading-snug">
                          Sign in to sync your items across all your devices.
                        </p>
                        <div className="flex items-center gap-2 mt-2.5">
                          <Button
                            asChild
                            size="sm"
                            className="h-7 rounded-lg bg-sky-600 text-white text-[11px] font-bold hover:bg-sky-700 px-3 border-none shadow-xs"
                          >
                            <Link href="/customer/login">Sign In</Link>
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-lg text-sky-700 hover:text-sky-950 hover:bg-sky-100/60 text-[11px] font-medium px-2.5"
                          >
                            <Link href="/customer/registration">Register</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {topWishlistItems.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-600">No items in wishlist yet.</div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {topWishlistItems.map((item) => (
                      <DropdownMenuItem key={item.wishlistItemId} asChild className="p-0">
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <Link
                            href={item.productId ? `/product/${item.productId}` : `/service/${item.serviceId}`}
                            className="flex min-w-0 flex-1 items-center gap-3"
                          >
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-slate-100">
                              {(item.product?.image || item.service?.image) ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={item.product?.image || item.service?.image || ""} alt={item.product?.name || item.service?.name || ""} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-slate-400">
                                  <Heart className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm font-medium text-slate-900">
                                {item.product?.name || item.service?.name || (item.productId ? "View Product" : "View Service")}
                              </p>
                              {typeof (item.product?.price || item.service?.price) === "number" && (
                                <p className="text-xs font-semibold text-blue-600">{formatCurrency(item.product?.price || item.service?.price || 0)}</p>
                              )}
                            </div>
                          </Link>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              void removeWishlist(item.productId ?? undefined, item.serviceId ?? undefined)
                            }}
                            aria-label={`Remove ${item.product?.name || item.service?.name} from wishlist`}
                            title="Remove from wishlist"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/browse" className="justify-center py-2 font-medium text-blue-700">
                    Browse marketplace
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {mounted && isLoggedIn && (
            <div className="hidden md:block order-50">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn("relative h-9 w-9 rounded-full p-0", isFoodSection ? "text-amber-950 hover:bg-amber-100/50" : "text-white hover:bg-slate-600/50 hover:text-white")}
                    aria-label="Open profile"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || ""} />
                      <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      {session?.user?.name && <p className="text-sm font-medium leading-none">{session.user.name}</p>}
                      {session?.user?.email && <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={profileHref} className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{profileLabel}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      signOut({ redirect: false }).then(() => {
                        window.location.href = "/"
                      })
                    }
                  >
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </nav>
      </div>

      {/* MOBILE PANEL QUICK NAV BAR — 4 Core System Panels Pill Bar */}
      <div className="flex md:hidden border-t border-slate-200/50 bg-white/95 backdrop-blur-md px-3 py-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-1.5 w-max mx-auto">
          {(() => {
            const isMarketActive = pathname === "/" || pathname === "/browse"
            const isServiceActive = pathname?.startsWith("/service") ?? false
            const isHotelActive = pathname?.startsWith("/hotels") ?? false
            const isFoodActive = pathname?.startsWith("/foods") ?? false

            return (
              <>
                <Link
                  href="/"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all shadow-2xs whitespace-nowrap",
                    isMarketActive
                      ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-950/20"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  <span>🛍️</span>
                  <span>Marketplace</span>
                </Link>

                <Link
                  href="/service"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all shadow-2xs whitespace-nowrap",
                    isServiceActive
                      ? "bg-amber-400 text-slate-950 shadow-sm ring-1 ring-amber-500/30"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  <span>🛠️</span>
                  <span>Services</span>
                </Link>

                <Link
                  href="/hotels"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all shadow-2xs whitespace-nowrap",
                    isHotelActive
                      ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700/30"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  <span>🏨</span>
                  <span>Hotels</span>
                </Link>

                <Link
                  href="/foods"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all shadow-2xs whitespace-nowrap",
                    isFoodActive
                      ? "bg-orange-600 text-white shadow-sm ring-1 ring-orange-700/30"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  <span>🍔</span>
                  <span>Restaurants</span>
                </Link>
              </>
            )
          })()}
        </div>
      </div>
    </header>
  )
}

type FooterCategoryItem = { id: string; name: string; href: string }

export function SiteFooter() {
  const pathname = usePathname()
  const isFoodSection = pathname?.startsWith("/foods")
  const isHotelSection = pathname?.startsWith("/hotels")
  const isServiceSection = pathname?.startsWith("/service")

  const { data: session, status } = useSession()
  const isLoggedIn = status === "authenticated" && !!session?.user
  const canUseCart = status !== "authenticated" || session?.user?.role === UserRole.CUSTOMER

  const [categoryItems, setCategoryItems] = useState<FooterCategoryItem[]>([])
  const [categoryHeading, setCategoryHeading] = useState("Browse Categories")

  useEffect(() => {
    let active = true

    if (isFoodSection) {
      setCategoryHeading("Browse Food Cuisines")
      const fallback = ["Pizza", "Burger", "Italian", "Indian", "Biryani", "Chinese", "Desserts", "African", "Seafood", "Tacos"]
      fetch("/api/customer/restaurants")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!active) return
          const cuisines: string[] = Array.isArray(data?.cuisines) && data.cuisines.length > 0 ? data.cuisines : fallback
          setCategoryItems(
            cuisines.slice(0, 10).map((c) => ({
              id: c,
              name: c,
              href: `/foods?cuisine=${encodeURIComponent(c)}`,
            }))
          )
        })
        .catch(() => {
          if (active) {
            setCategoryItems(
              fallback.map((c) => ({
                id: c,
                name: c,
                href: `/foods?cuisine=${encodeURIComponent(c)}`,
              }))
            )
          }
        })
    } else if (isHotelSection) {
      setCategoryHeading("Browse Hotels by City")
      const fallback = ["Freetown", "Bo", "Kenema", "Makeni"]
      fetch("/api/hotels")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!active) return
          let items: string[] = []
          if (Array.isArray(data?.cities) && data.cities.length > 0) {
            items = [...data.cities]
          }
          if (items.length === 0) items = fallback

          setCategoryItems(
            items.slice(0, 10).map((item) => ({
              id: item,
              name: item,
              href: `/hotels?city=${encodeURIComponent(item)}`,
            }))
          )
        })
        .catch(() => {
          if (active) {
            setCategoryItems(
              fallback.map((item) => ({
                id: item,
                name: item,
                href: `/hotels?city=${encodeURIComponent(item)}`,
              }))
            )
          }
        })
    } else if (isServiceSection) {
      setCategoryHeading("Browse Service Categories")
      fetch("/api/service-categories")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!active) return
          const rawCats = Array.isArray(data?.categories) ? data.categories : []
          setCategoryItems(
            rawCats.slice(0, 10).map((cat: any) => ({
              id: cat.id,
              name: cat.name,
              href: `/service?serviceCategoryId=${cat.id}`,
            }))
          )
        })
        .catch(() => {
          if (active) setCategoryItems([])
        })
    } else {
      setCategoryHeading("Browse Product Categories")
      fetch("/api/home/categories")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!active) return
          const rawCats = Array.isArray(data) ? data : []
          setCategoryItems(
            rawCats.slice(0, 10).map((cat: any) => ({
              id: cat.id,
              name: cat.name,
              href: `/browse?categoryId=${cat.id}`,
            }))
          )
        })
        .catch(() => {
          if (active) setCategoryItems([])
        })
    }

    return () => {
      active = false
    }
  }, [isFoodSection, isHotelSection, isServiceSection])

  const categoriesCol1 = categoryItems.slice(0, 5)
  const categoriesCol2 = categoryItems.slice(5, 10)

  const linkClass = isFoodSection
    ? "text-sm text-amber-800 transition-colors hover:text-amber-950 hover:underline"
    : isHotelSection
      ? "text-sm text-emerald-900 transition-colors hover:text-emerald-950 hover:underline"
      : isServiceSection
        ? "text-sm text-indigo-900 transition-colors hover:text-indigo-950 hover:underline"
        : "text-sm text-slate-700 transition-colors hover:text-slate-900 hover:underline"

  const headingClass = isFoodSection
    ? "mb-3 text-sm font-bold uppercase tracking-wider text-amber-950 sm:mb-4"
    : isHotelSection
      ? "mb-3 text-sm font-bold uppercase tracking-wider text-emerald-950 sm:mb-4"
      : isServiceSection
        ? "mb-3 text-sm font-bold uppercase tracking-wider text-indigo-950 sm:mb-4"
        : "mb-3 text-sm font-semibold uppercase tracking-wider text-slate-800 sm:mb-4"

  return (
    <footer className={cn(
      "border-t shadow-[0_-2px_10px_rgba(0,0,0,0.06)]",
      isFoodSection
        ? "border-[#E8DFD8] bg-[#F5EFE6] text-amber-950"
        : isHotelSection
          ? "border-emerald-900/20 bg-gradient-to-r from-emerald-50 via-emerald-100 to-emerald-200 text-slate-800"
          : isServiceSection
            ? "border-indigo-900/20 bg-gradient-to-r from-slate-50 via-indigo-50 to-slate-100 text-slate-800"
            : "border-blue-900/20 bg-gradient-to-r from-blue-50 via-blue-200 to-cyan-600 text-slate-800"
    )}>
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-6 lg:grid-cols-[1fr_1fr_1fr_auto] lg:gap-8 lg:items-start">
          {/* Quick Links */}
          <nav aria-label="Quick links" className="min-w-0">
            <p className={headingClass}>Quick Links</p>
            <ul className="flex flex-col gap-1.5">
              <li><Link href="/" className={linkClass}>Marketplace</Link></li>
              <li><Link href="/service" className={linkClass}>Services</Link></li>
              <li><Link href="/hotels" className={linkClass}>Hotels</Link></li>
              <li><Link href="/foods" className={linkClass}>Restaurants</Link></li>
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
                  <li><Link href="/hotel-seller/login" className={linkClass}>Hotel Seller Login</Link></li>
                  <li><Link href="/restaurant-seller/login" className={linkClass}>Restaurant Seller Login</Link></li>
                </>
              )}
              <li className="mt-1 border-t border-slate-200/50 pt-1.5 dark:border-slate-700/50">
                <Link href="/terms-and-conditions" className={linkClass}>Terms & Conditions</Link>
              </li>
              <li>
                <Link href="/privacy-policy" className={linkClass}>Privacy Policy</Link>
              </li>
            </ul>
          </nav>

          {/* Panel-Specific Categories */}
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <p className={headingClass}>{categoryHeading}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:gap-x-6">
              <ul className="flex flex-col gap-1.5">
                {categoriesCol1.map((cat) => (
                  <li key={cat.id}>
                    <Link href={cat.href} className={linkClass}>{cat.name}</Link>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-1.5">
                {categoriesCol2.map((cat) => (
                  <li key={cat.id}>
                    <Link href={cat.href} className={linkClass}>{cat.name}</Link>
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
                  <span className="break-words">Freetown Sierra Leone</span>
                </div>
              </div>
              <a href="/" className="mt-2 ml-14 shrink-0 sm:mt-3 sm:ml-14" aria-label="MEEEM home">
                <Image src="/images/logo.png" alt="MEEEM" width={150} height={45} className="h-12 w-auto object-contain sm:h-14" />
              </a>
            </div>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                <div className="flex flex-col">
                  <a href="mailto:info@meeemsl.com" className="hover:text-slate-900 hover:underline">info@meeemsl.com</a>
                  <a href="mailto:Support@meeemsl.com" className="hover:text-slate-900 hover:underline">Support@meeemsl.com</a>
                </div>
              </li>
              {/* <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-slate-600" />
                <a href="tel:+23288300000" className="hover:text-slate-900 hover:underline">+232 88 300000</a>
              </li> */}
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
        <div className={cn(
          "mt-6 flex flex-col items-center justify-between gap-4 border-t pt-4 sm:flex-row sm:mt-7 sm:pt-5",
          isFoodSection ? "border-[#E8DFD8]" : "border-blue-900/20"
        )}>
          <p className={cn("text-center text-xs sm:text-left", isFoodSection ? "text-amber-800" : "text-slate-600")}>
            © {new Date().getFullYear()} MEEEM Marketplace. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isFoodSection = pathname?.startsWith("/foods")
  const isHotelSection = pathname === "/hotels"
  return (
    <div className={cn(
      "flex min-h-screen flex-col text-foreground",
      isFoodSection ? "bg-[#FAF8F5]" : isHotelSection ? "bg-[#F4F9F5]" : PAGE_BACKGROUND
    )}>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}

export { PAGE_BACKGROUND }
