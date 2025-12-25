import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"

export async function middleware(request: NextRequest) {
  const session = await auth()
  const path = request.nextUrl.pathname

  // Protect dashboard routes
  if (path.startsWith("/dashboard")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    // Admin routes
    if (path.startsWith("/dashboard/admin")) {
      if (session.user.role !== UserRole.ADMIN) {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }
    }

    // Seller routes
    if (path.startsWith("/dashboard/seller")) {
      if (session.user.role !== UserRole.SELLER_PRODUCT && session.user.role !== UserRole.SELLER_SERVICE) {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }
    }

    // Customer routes
    if (path.startsWith("/dashboard/customer")) {
      if (session.user.role !== UserRole.CUSTOMER) {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/protected/:path*",
  ],
}

