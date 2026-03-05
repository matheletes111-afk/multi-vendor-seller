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
    "/admin/login",
    "/admin/registration",
    "/admin/verify-otp",
    "/product-seller/login",
    "/product-seller/registration",
    "/product-seller/verify-otp",
    "/service-seller/login",
    "/service-seller/registration",
    "/service-seller/verify-otp",
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
    if (path === "/customer/login" || path === "/customer/registration" || path === "/customer/verify-otp" || path.startsWith("/customer/login?") || path.startsWith("/customer/registration?") || path.startsWith("/customer/verify-otp?")) {
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
    if (path === "/admin/login" || path === "/admin/registration" || path === "/admin/verify-otp" || path.startsWith("/admin/login?") || path.startsWith("/admin/registration?") || path.startsWith("/admin/verify-otp?")) {
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
    if (path === "/product-seller/login" || path === "/product-seller/registration" || path === "/product-seller/verify-otp" || path.startsWith("/product-seller/login?") || path.startsWith("/product-seller/registration?") || path.startsWith("/product-seller/verify-otp?")) {
      return NextResponse.next()
    }
    if (!session?.user) {
      return NextResponse.redirect(new URL("/product-seller/login", request.url))
    }
    if (session.user.role !== UserRole.SELLER_PRODUCT) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    // Unapproved or suspended sellers cannot access dashboard
    const u = session.user as { isApproved?: boolean; isSuspended?: boolean }
    if (u.isApproved === false || u.isSuspended === true) {
      return NextResponse.redirect(new URL("/product-seller/login?error=AccountPendingOrSuspended", request.url))
    }
  }

  // Service seller routes (allow login, registration, verify-otp without session)
  if (path.startsWith("/service-seller")) {
    if (path === "/service-seller/login" || path === "/service-seller/registration" || path === "/service-seller/verify-otp" || path.startsWith("/service-seller/login?") || path.startsWith("/service-seller/registration?") || path.startsWith("/service-seller/verify-otp?")) {
      return NextResponse.next()
    }
    if (!session?.user) {
      return NextResponse.redirect(new URL("/service-seller/login", request.url))
    }
    if (session.user.role !== UserRole.SELLER_SERVICE) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    // Unapproved or suspended sellers cannot access dashboard
    const u = session.user as { isApproved?: boolean; isSuspended?: boolean }
    if (u.isApproved === false || u.isSuspended === true) {
      return NextResponse.redirect(new URL("/service-seller/login?error=AccountPendingOrSuspended", request.url))
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

