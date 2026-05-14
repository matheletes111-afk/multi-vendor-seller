import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  console.log(`Middleware: ${path}`)

  // Allow panel login/registration without running auth (avoids NextAuth redirect to pages.signIn)
  const allowedAuthPaths = [
    "/customer/login",
    "/customer/registration",
    "/customer/verify-otp",
    "/customer/login/email-otp",
    "/customer/login/email-otp/verify",
    "/customer/login/phone-otp",
    "/customer/login/phone-otp/verify",
    "/customer/forgot-password",
    "/customer/reset-password",
    "/admin/login",
    "/admin/registration",
    "/admin/verify-otp",
    "/admin/forgot-password",
    "/admin/reset-password",
    "/product-seller/login",
    "/product-seller/registration",
    "/product-seller/verify-otp",
    "/product-seller/login/email-otp",
    "/product-seller/login/email-otp/verify",
    "/product-seller/login/phone-otp",
    "/product-seller/login/phone-otp/verify",
    "/product-seller/forgot-password",
    "/product-seller/reset-password",
    "/service-seller/login",
    "/service-seller/registration",
    "/service-seller/verify-otp",
    "/service-seller/login/email-otp",
    "/service-seller/login/email-otp/verify",
    "/service-seller/login/phone-otp",
    "/service-seller/login/phone-otp/verify",
    "/service-seller/forgot-password",
    "/service-seller/reset-password",
    "/hotel-seller/login",
    "/hotel-seller/registration",
    "/hotel-seller/verify-otp",
    "/hotel-seller/login/email-otp",
    "/hotel-seller/login/email-otp/verify",
    "/hotel-seller/login/phone-otp",
    "/hotel-seller/login/phone-otp/verify",
    "/hotel-seller/forgot-password",
    "/hotel-seller/reset-password",
    "/restaurant-seller/login",
    "/restaurant-seller/registration",
    "/restaurant-seller/verify-otp",
    "/restaurant-seller/login/email-otp",
    "/restaurant-seller/login/email-otp/verify",
    "/restaurant-seller/login/phone-otp",
    "/restaurant-seller/login/phone-otp/verify",
    "/restaurant-seller/forgot-password",
    "/restaurant-seller/reset-password",
  ]
  if (allowedAuthPaths.some((p) => path === p || path.startsWith(p + "?"))) {
    return NextResponse.next()
  }

  const session = await auth()

  // Redirect old public browse URL to new public /browse (no login required)
  if (path === "/customer/browse" || path.startsWith("/customer/browse?")) {
    const url = new URL("/browse", request.url)
    url.search = request.nextUrl.search
    return NextResponse.redirect(url)
  }

  // /dashboard: single entry that redirects to the logged-in user's panel (no app/dashboard folder)
  if (path === "/dashboard" || path.startsWith("/dashboard/")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/customer/login", request.url))
    }
    switch (session.user.role) {
      case UserRole.ADMIN:
        return NextResponse.redirect(new URL("/admin", request.url))
      case UserRole.SELLER_PRODUCT:
        return NextResponse.redirect(new URL("/product-seller", request.url))
      case UserRole.SELLER_SERVICE:
        return NextResponse.redirect(new URL("/service-seller", request.url))
      case UserRole.SELLER_HOTEL:
        return NextResponse.redirect(new URL("/hotel-seller", request.url))
      case UserRole.SELLER_RESTAURANT:
        return NextResponse.redirect(new URL("/restaurant-seller", request.url))
      case UserRole.CUSTOMER:
        return NextResponse.redirect(new URL("/customer", request.url))
      default:
        return NextResponse.redirect(new URL("/", request.url))
    }
  }

  // Customer routes (allow login, registration, verify-otp without session)
  if (path.startsWith("/customer")) {
    if (
      path === "/customer/login" ||
      path === "/customer/registration" ||
      path === "/customer/verify-otp" ||
      path === "/customer/login/email-otp" ||
      path === "/customer/login/email-otp/verify" ||
      path === "/customer/login/phone-otp" ||
      path === "/customer/login/phone-otp/verify" ||
      path === "/customer/forgot-password" ||
      path === "/customer/reset-password" ||
      path.startsWith("/customer/login?") ||
      path.startsWith("/customer/registration?") ||
      path.startsWith("/customer/verify-otp?") ||
      path.startsWith("/customer/login/email-otp?") ||
      path.startsWith("/customer/login/email-otp/verify?") ||
      path.startsWith("/customer/login/phone-otp?") ||
      path.startsWith("/customer/login/phone-otp/verify?") ||
      path.startsWith("/customer/forgot-password?") ||
      path.startsWith("/customer/reset-password?")
    ) {
      return NextResponse.next()
    }
    if (!session?.user) {
      return NextResponse.redirect(new URL("/customer/login", request.url))
    }
    if (session.user.role !== UserRole.CUSTOMER) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // Admin routes (allow login, registration, verify-otp without session)
  if (path.startsWith("/admin")) {
    if (
      path === "/admin/login" ||
      path === "/admin/registration" ||
      path === "/admin/verify-otp" ||
      path === "/admin/forgot-password" ||
      path === "/admin/reset-password" ||
      path.startsWith("/admin/login?") ||
      path.startsWith("/admin/registration?") ||
      path.startsWith("/admin/verify-otp?") ||
      path.startsWith("/admin/forgot-password?") ||
      path.startsWith("/admin/reset-password?")
    ) {
      return NextResponse.next()
    }
    if (!session?.user) {
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // Seller routes (Product, Service, Hotel, Restaurant)
  if (path.startsWith("/product-seller") || path.startsWith("/service-seller") || path.startsWith("/hotel-seller") || path.startsWith("/restaurant-seller")) {
    const isService = path.startsWith("/service-seller")
    const isHotel = path.startsWith("/hotel-seller")
    const isRestaurant = path.startsWith("/restaurant-seller")
    
    let prefix = "/product-seller"
    let expectedRole: UserRole = UserRole.SELLER_PRODUCT
    
    if (isService) {
      prefix = "/service-seller"
      expectedRole = UserRole.SELLER_SERVICE
    } else if (isHotel) {
      prefix = "/hotel-seller"
      expectedRole = UserRole.SELLER_HOTEL
    } else if (isRestaurant) {
      prefix = "/restaurant-seller"
      expectedRole = UserRole.SELLER_RESTAURANT
    }
    
    // Public paths for sellers
    if (
      path === `${prefix}/login` ||
      path === `${prefix}/registration` ||
      path === `${prefix}/verify-otp` ||
      path === `${prefix}/login/email-otp` ||
      path === `${prefix}/login/email-otp/verify` ||
      path === `${prefix}/login/phone-otp` ||
      path === `${prefix}/login/phone-otp/verify` ||
      path === `${prefix}/forgot-password` ||
      path === `${prefix}/reset-password` ||
      path.startsWith(`${prefix}/login?`) ||
      path.startsWith(`${prefix}/registration?`) ||
      path.startsWith(`${prefix}/verify-otp?`) ||
      path.startsWith(`${prefix}/login/email-otp?`) ||
      path.startsWith(`${prefix}/login/email-otp/verify?`) ||
      path.startsWith(`${prefix}/login/phone-otp?`) ||
      path.startsWith(`${prefix}/login/phone-otp/verify?`) ||
      path.startsWith(`${prefix}/forgot-password?`) ||
      path.startsWith(`${prefix}/reset-password?`)
    ) {
      return NextResponse.next()
    }

    if (!session?.user) {
      return NextResponse.redirect(new URL(`${prefix}/login`, request.url))
    }
    if (session.user.role !== expectedRole) {
      return NextResponse.redirect(new URL(`${prefix}/login?error=InvalidRole`, request.url))
    }

    const u = session.user as { onboardingCompleted?: boolean; isApproved?: boolean; isSuspended?: boolean }
    if (u.isSuspended === true) {
      return NextResponse.redirect(new URL(`${prefix}/login?error=AccountSuspended`, request.url))
    }

    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path
    const isOnboardingRoute = normalizedPath === `${prefix}/onboarding` || normalizedPath.startsWith(`${prefix}/onboarding/`)
    const isSettingsRoute = normalizedPath === `${prefix}/settings` || normalizedPath.startsWith(`${prefix}/settings/`)

    // 1) Handle Onboarding (Allow access to onboarding route, force redirect others if not done)
    if (!u.onboardingCompleted && !isOnboardingRoute) {
      return NextResponse.redirect(new URL(`${prefix}/onboarding`, request.url))
    }

    // 2) Handle Approval (Allow access to settings and onboarding while pending, force redirect others to settings)
    if (u.isApproved === false && !isSettingsRoute && !isOnboardingRoute) {
      return NextResponse.redirect(new URL(`${prefix}/settings?error=AccountPendingApproval`, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customer/:path*",
    "/admin/:path*",
    "/product-seller",
    "/product-seller/:path*",
    "/service-seller",
    "/service-seller/:path*",
    "/hotel-seller",
    "/hotel-seller/:path*",
    "/restaurant-seller",
    "/restaurant-seller/:path*",
    "/api/protected/:path*",
  ],
}

