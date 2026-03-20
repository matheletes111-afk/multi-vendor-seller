import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { SellerType, UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { encode, getToken } from "next-auth/jwt"

// Ensure this runs in Node runtime (Prisma + Auth.js server helpers).
export const runtime = "nodejs"

const ALLOWED_ROLES: Record<string, UserRole> = {
  CUSTOMER: UserRole.CUSTOMER,
  SELLER_PRODUCT: UserRole.SELLER_PRODUCT,
  SELLER_SERVICE: UserRole.SELLER_SERVICE,
}

const ROLE_DEFAULT_NEXT: Record<UserRole, string> = {
  [UserRole.CUSTOMER]: "/",
  [UserRole.SELLER_PRODUCT]: "/product-seller",
  [UserRole.SELLER_SERVICE]: "/service-seller",
  [UserRole.ADMIN]: "/admin",
}

const ALLOWED_NEXT_PREFIXES = ["/customer", "/product-seller", "/service-seller", "/admin", "/dashboard", "/"]

function isAllowedNextPath(next: string) {
  if (!next || typeof next !== "string") return false
  if (!next.startsWith("/")) return false
  if (next.startsWith("//")) return false
  return ALLOWED_NEXT_PREFIXES.some((p) => next === p || (p !== "/" && next.startsWith(p + "/")))
}

/**
 * Cookie-free post-processing step for OAuth social login.
 *
 * NextAuth redirects to this endpoint using `signIn(..., { callbackUrl: "/api/auth/oauth-postprocess?...&next=..." })`.
 * We use the `role` query param to update the user's DB role + seller record.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const roleParam = searchParams.get("role") ?? ""
  const nextParam = searchParams.get("next") ?? ""

  const intendedRole = ALLOWED_ROLES[roleParam]
  if (!intendedRole) {
    return NextResponse.redirect(new URL("/customer/login?error=InvalidRole", request.url))
  }

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.redirect(new URL("/customer/login?error=OAuthSessionMissing", request.url))
  }

  const safeNext = isAllowedNextPath(nextParam) ? nextParam : ROLE_DEFAULT_NEXT[intendedRole]
  const redirectResponse = NextResponse.redirect(new URL(safeNext, request.url))

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      password: true,
      isEmailVerified: true,
      seller: { select: { type: true } },
    },
  })
  if (!existingUser) {
    return NextResponse.redirect(new URL("/customer/login?error=UserNotFound", request.url))
  }

  // Prevent cross-panel role overwrites for the same email.
  // Example: if a user is already a Product Seller, logging in from Service Seller
  // should show an error instead of flipping the role/type in the DB.
  if (intendedRole === UserRole.SELLER_PRODUCT) {
    const currentIsServiceSeller =
      existingUser.role === UserRole.SELLER_SERVICE || existingUser.seller?.type === SellerType.SERVICE
    if (currentIsServiceSeller) {
      return NextResponse.redirect(new URL("/product-seller/login?error=EmailAlreadyUsedAsServiceSeller", request.url))
    }

    // If the user is already a verified customer (or created via credentials with a password),
    // do not allow overwriting them into a seller.
    if (
      existingUser.role === UserRole.CUSTOMER &&
      (existingUser.password !== null || existingUser.isEmailVerified === true)
    ) {
      return NextResponse.redirect(new URL("/product-seller/login?error=EmailAlreadyUsedAsCustomer", request.url))
    }
  }
  if (intendedRole === UserRole.SELLER_SERVICE) {
    const currentIsProductSeller =
      existingUser.role === UserRole.SELLER_PRODUCT || existingUser.seller?.type === SellerType.PRODUCT
    if (currentIsProductSeller) {
      return NextResponse.redirect(new URL("/service-seller/login?error=EmailAlreadyUsedAsProductSeller", request.url))
    }

    if (
      existingUser.role === UserRole.CUSTOMER &&
      (existingUser.password !== null || existingUser.isEmailVerified === true)
    ) {
      return NextResponse.redirect(new URL("/service-seller/login?error=EmailAlreadyUsedAsCustomer", request.url))
    }
  }
  if (intendedRole === UserRole.CUSTOMER) {
    const currentIsSeller = existingUser.role === UserRole.SELLER_PRODUCT || existingUser.role === UserRole.SELLER_SERVICE
    if (currentIsSeller) {
      return NextResponse.redirect(
        new URL(`/customer/login?error=EmailAlreadyUsedAsSeller&currentRole=${encodeURIComponent(existingUser.role)}`, request.url),
      )
    }
  }

  if (intendedRole === UserRole.CUSTOMER) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.CUSTOMER, isEmailVerified: true },
    })

    // If the user previously had a seller profile, remove it so token.role won't become seller again.
    if (existingUser.seller) {
      await prisma.seller.delete({ where: { userId } })
    }
  } else if (intendedRole === UserRole.SELLER_PRODUCT) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.SELLER_PRODUCT, isEmailVerified: true },
    })
    await prisma.seller.upsert({
      where: { userId },
      create: { userId, type: SellerType.PRODUCT },
      update: { type: SellerType.PRODUCT },
    })
  } else if (intendedRole === UserRole.SELLER_SERVICE) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.SELLER_SERVICE, isEmailVerified: true },
    })
    await prisma.seller.upsert({
      where: { userId },
      create: { userId, type: SellerType.SERVICE },
      update: { type: SellerType.SERVICE },
    })
  }

  // Update NextAuth JWT cookie immediately so edge middleware sees the new role.
  // This avoids querying Prisma inside `callbacks.jwt` (which runs in Edge).
  const secret = process.env.NEXTAUTH_SECRET
  if (secret) {
    const secureCookie = request.url.startsWith("https://")
    const cookieName = secureCookie ? "__Secure-authjs.session-token" : "authjs.session-token"

    const existingToken = await getToken({
      req: request,
      secret,
      secureCookie,
      cookieName,
    })

    if (existingToken) {
      ;(existingToken as any).role = intendedRole
      if (intendedRole === UserRole.CUSTOMER) {
        delete (existingToken as any).isApproved
        delete (existingToken as any).isSuspended
      } else {
        const seller = await prisma.seller.findUnique({
          where: { userId },
          select: { isApproved: true, isSuspended: true },
        })
        ;(existingToken as any).isApproved = seller?.isApproved ?? false
        ;(existingToken as any).isSuspended = seller?.isSuspended ?? false
      }

      // Keep email in sync as well.
      if (session?.user?.email) {
        ;(existingToken as any).email = session.user.email
      }

      const newJwt = await encode({
        token: existingToken as any,
        secret,
        salt: cookieName,
      })

      redirectResponse.cookies.set(cookieName, newJwt, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: secureCookie,
      })
    }
  }

  return redirectResponse
}

