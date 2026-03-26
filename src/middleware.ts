import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

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

  // Product seller routes (allow login, registration, verify-otp without session)
  if (path.startsWith("/product-seller")) {
    if (
      path === "/product-seller/login" ||
      path === "/product-seller/registration" ||
      path === "/product-seller/verify-otp" ||
      path === "/product-seller/login/email-otp" ||
      path === "/product-seller/login/email-otp/verify" ||
      path === "/product-seller/login/phone-otp" ||
      path === "/product-seller/login/phone-otp/verify" ||
      path === "/product-seller/forgot-password" ||
      path === "/product-seller/reset-password" ||
      path.startsWith("/product-seller/login?") ||
      path.startsWith("/product-seller/registration?") ||
      path.startsWith("/product-seller/verify-otp?") ||
      path.startsWith("/product-seller/login/email-otp?") ||
      path.startsWith("/product-seller/login/email-otp/verify?") ||
      path.startsWith("/product-seller/login/phone-otp?") ||
      path.startsWith("/product-seller/login/phone-otp/verify?") ||
      path.startsWith("/product-seller/forgot-password?") ||
      path.startsWith("/product-seller/reset-password?")
    ) {
      return NextResponse.next()
    }
    if (!session?.user) {
      return NextResponse.redirect(new URL("/product-seller/login", request.url))
    }
    if (session.user.role !== UserRole.SELLER_PRODUCT) {
      return NextResponse.redirect(new URL("/product-seller/login?error=NoSellerAccount", request.url))
    }
    const u = session.user as { isApproved?: boolean; isSuspended?: boolean }
    // Suspended sellers cannot access dashboard at all
    if (u.isSuspended === true) {
      return NextResponse.redirect(new URL("/product-seller/login?error=AccountSuspended", request.url))
    }
    // Pending approval: allow only settings/profile page; redirect all other routes to settings
    const isSettingsRoute =
      path === "/product-seller/settings" || path.startsWith("/product-seller/settings/")
    if (u.isApproved === false && !isSettingsRoute) {
      return NextResponse.redirect(new URL("/product-seller/settings?error=AccountPendingApproval", request.url))
    }
  }

  // Service seller routes (allow login, registration, verify-otp without session)
  if (path.startsWith("/service-seller")) {
    if (
      path === "/service-seller/login" ||
      path === "/service-seller/registration" ||
      path === "/service-seller/verify-otp" ||
      path === "/service-seller/login/email-otp" ||
      path === "/service-seller/login/email-otp/verify" ||
      path === "/service-seller/login/phone-otp" ||
      path === "/service-seller/login/phone-otp/verify" ||
      path === "/service-seller/forgot-password" ||
      path === "/service-seller/reset-password" ||
      path.startsWith("/service-seller/login?") ||
      path.startsWith("/service-seller/registration?") ||
      path.startsWith("/service-seller/verify-otp?") ||
      path.startsWith("/service-seller/login/email-otp?") ||
      path.startsWith("/service-seller/login/email-otp/verify?") ||
      path.startsWith("/service-seller/login/phone-otp?") ||
      path.startsWith("/service-seller/login/phone-otp/verify?") ||
      path.startsWith("/service-seller/forgot-password?") ||
      path.startsWith("/service-seller/reset-password?")
    ) {
      return NextResponse.next()
    }
    if (!session?.user) {
      return NextResponse.redirect(new URL("/service-seller/login", request.url))
    }
    if (session.user.role !== UserRole.SELLER_SERVICE) {
      return NextResponse.redirect(new URL("/service-seller/login?error=NoSellerAccount", request.url))
    }
    const u = session.user as { isApproved?: boolean; isSuspended?: boolean }
    // Suspended sellers cannot access dashboard at all
    if (u.isSuspended === true) {
      return NextResponse.redirect(new URL("/service-seller/login?error=AccountSuspended", request.url))
    }
    // Pending approval: allow only settings/profile page; redirect all other routes to settings
    const isSettingsRoute =
      path === "/service-seller/settings" || path.startsWith("/service-seller/settings/")
    if (u.isApproved === false && !isSettingsRoute) {
      return NextResponse.redirect(new URL("/service-seller/settings?error=AccountPendingApproval", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customer/:path*",
    "/admin/:path*",
    "/product-seller/:path*",
    "/service-seller/:path*",
    "/api/protected/:path*",
  ],
}

