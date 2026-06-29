"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { formatCurrency } from "@/lib/utils"
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
import { ChevronDown, Heart, LayoutGrid, Menu, Search, ShoppingCart, Trash2, MapPin, Mail, Phone, Facebook, Twitter, Instagram, Linkedin, Youtube, User } from "lucide-react"
import { ReactNode } from "react"

const PAGE_BACKGROUND = "bg-gradient-to-b from-violet-300 via-purple-100 to-pink-100"

type Subcategory = { id: string; name: string; slug: string; image: string | null }
type Category = { id: string; name: string; slug: string; subcategories: Subcategory[] }
type ServiceCategory = { id: string; name: string; slug: string }

export function SiteHeader() {
  const router = useRouter()
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
                  {serviceCategories.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="font-medium">
                        Service Categories
                      </DropdownMenuLabel>
                      {serviceCategories.map((cat) => (
                        <DropdownMenuItem asChild key={`service-${cat.id}`}>
                          <Link href={`/browse?serviceCategoryId=${cat.id}`} className="pl-6 text-sm text-slate-600">
                            {cat.name}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
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
              className="h-9 min-w-0 rounded-l-md border-l border-amber-400 border-r-0 bg-white py-2 text-sm focus-visible:ring-amber-500 sm:h-10 sm:rounded-l-none sm:border-l-0 sm:text-base"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-l-none border border-l-0 border-amber-400 bg-amber-400 text-black hover:bg-amber-500 sm:h-10 sm:w-10">
              <Search className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
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
                      All Category
                    </Link>
                    <Link href="/foods" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100">
                      <span className="text-base">🍔</span>
                      Order Food / Restaurants
                    </Link>
                    <Link href="/hotels" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100">
                      <span className="text-base">🏨</span>
                      Book Hotels
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
                    {serviceCategories.length > 0 && (
                      <>
                        <div className="my-2 border-t border-slate-200" />
                        <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Service Categories
                        </p>
                        {serviceCategories.map((cat) => (
                          <Link href={`/browse?serviceCategoryId=${cat.id}`} key={`mobile-service-${cat.id}`} className="flex px-4 py-2.5 pl-8 text-sm text-slate-700 hover:bg-slate-100">
                            {cat.name}
                          </Link>
                        ))}
                      </>
                    )}
                    <div className="my-2 border-t border-slate-200" />
                    {showBecomePartner && (
                      <>
                        <Link href="/product-seller/login" className="px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100">
                          Product Seller Login
                        </Link>
                        <Link href="/service-seller/login" className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                          Service Seller Login
                        </Link>
                        <Link href="/hotel-seller/login" className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                          Hotel Seller Login
                        </Link>
                        <Link href="/restaurant-seller/login" className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                          Restaurant Seller Login
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
                    {showOrdersLink && (
                      <Link href="/my-orders" className="px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">
                        Orders
                      </Link>
                    )}
                    {canUseWishlist && (
                      <Link href="/browse" className="px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">
                        Wishlist ({wishlistCount})
                      </Link>
                    )}
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

          {/* Mobile user menu (avatar + profile/logout) */}
          {mounted && isLoggedIn && (
            <div className="md:hidden order-50">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-9 w-9 rounded-full p-0 text-white hover:bg-slate-600/50 hover:text-white"
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
                <Link href="/foods" className="flex items-center rounded px-2 py-1.5 text-sm font-medium text-white hover:bg-slate-600/50 sm:px-3">
                  Restaurants
                </Link>
                <Link href="/hotels" className="flex items-center rounded px-2 py-1.5 text-sm font-medium text-white hover:bg-slate-600/50 sm:px-3">
                  Hotels
                </Link>
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
                <Link href="/foods" className="flex items-center rounded px-2 py-1.5 text-sm font-medium text-white hover:bg-slate-600/50 sm:px-3">
                  Restaurants
                </Link>
                <Link href="/hotels" className="flex items-center rounded px-2 py-1.5 text-sm font-medium text-white hover:bg-slate-600/50 sm:px-3">
                  Hotels
                </Link>
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

            {showOrdersLink && (
              <Link
                href="/my-orders"
                className="order-40 flex flex-col items-start rounded px-2 py-1.5 text-white hover:opacity-90"
                aria-label="Orders"
              >
                <span className="font-semibold">Orders</span>
              </Link>
            )}
          </div>

          {canUseCart && (
            <Link
              href="/cart"
              className="order-30 relative flex items-center gap-0.5 rounded p-1.5 text-white hover:opacity-90 sm:gap-1 sm:px-2 sm:py-1.5"
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

          {canUseWishlist && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="order-35 relative inline-flex h-9 items-center justify-center gap-1 rounded px-1.5 text-white hover:bg-slate-600/50 hover:text-white sm:h-10 sm:px-2"
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
                              <p className="line-clamp-2 text-sm font-medium text-slate-900">{item.product?.name || item.service?.name}</p>
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

          {/* Desktop-only profile avatar (right of cart) */}
          {mounted && isLoggedIn && (
            <div className="hidden md:block order-50">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-9 w-9 rounded-full p-0 text-white hover:bg-slate-600/50 hover:text-white"
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
              <li><Link href="/foods" className={linkClass}>Order Food / Restaurants</Link></li>
              <li><Link href="/hotels" className={linkClass}>Book Hotels</Link></li>
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
