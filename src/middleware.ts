import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"

export async function middleware(request: NextRequest) {
  const session = await auth()
  const path = request.nextUrl.pathname

  // Redirect old public browse URL to new public /browse (no login required)
  if (path === "/customer/browse" || path.startsWith("/customer/browse?")) {
    const url = new URL("/browse", request.url)
    url.search = request.nextUrl.search
    return NextResponse.redirect(url)
  }

  // Protect dashboard entry (role redirect only)
  if (path === "/dashboard" || path.startsWith("/dashboard/")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  // Customer routes
  if (path.startsWith("/customer")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    if (session.user.role !== UserRole.CUSTOMER) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // Admin routes
  if (path.startsWith("/admin")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // Product seller routes
  if (path.startsWith("/product-seller")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    if (session.user.role !== UserRole.SELLER_PRODUCT) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // Service seller routes
  if (path.startsWith("/service-seller")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    if (session.user.role !== UserRole.SELLER_SERVICE) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
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

