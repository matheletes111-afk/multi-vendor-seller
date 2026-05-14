import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { SellerType, UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { encode, getToken } from "next-auth/jwt"
import { activateFreePlan, activateHotelFreePlan, activateRestaurantFreePlan } from "@/lib/subscriptions"

// Ensure this runs in Node runtime (Prisma + Auth.js server helpers).
export const runtime = "nodejs"

const ALLOWED_ROLES: Record<string, UserRole> = {
  CUSTOMER: UserRole.CUSTOMER,
  SELLER_PRODUCT: UserRole.SELLER_PRODUCT,
  SELLER_SERVICE: UserRole.SELLER_SERVICE,
  SELLER_HOTEL: UserRole.SELLER_HOTEL,
  SELLER_RESTAURANT: UserRole.SELLER_RESTAURANT,
}

const ROLE_DEFAULT_NEXT: Record<UserRole, string> = {
  [UserRole.CUSTOMER]: "/",
  [UserRole.SELLER_PRODUCT]: "/product-seller",
  [UserRole.SELLER_SERVICE]: "/service-seller",
  [UserRole.SELLER_HOTEL]: "/hotel-seller",
  [UserRole.SELLER_RESTAURANT]: "/restaurant-seller",
  [UserRole.ADMIN]: "/admin",
}

const ALLOWED_NEXT_PREFIXES = ["/customer", "/product-seller", "/service-seller", "/hotel-seller", "/restaurant-seller", "/admin", "/dashboard", "/"]

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
  let redirectResponse = NextResponse.redirect(new URL(safeNext, request.url))

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      password: true,
      isEmailVerified: true,
      seller: { select: { type: true } },
      hotelSeller: { select: { id: true } },
      restaurantSeller: { select: { id: true } },
    },
  })
  if (!existingUser) {
    return NextResponse.redirect(new URL("/customer/login?error=UserNotFound", request.url))
  }

  const SELLER_ROLES: UserRole[] = [
    UserRole.SELLER_PRODUCT,
    UserRole.SELLER_SERVICE,
    UserRole.SELLER_HOTEL,
    UserRole.SELLER_RESTAURANT,
  ]

  const currentIsSeller = SELLER_ROLES.includes(existingUser.role) || !!existingUser.seller || !!existingUser.hotelSeller || !!existingUser.restaurantSeller

  // Prevent cross-panel role overwrites for the same email.
  if (intendedRole !== UserRole.CUSTOMER && currentIsSeller && existingUser.role !== intendedRole) {
    const redirectPrefix = ROLE_DEFAULT_NEXT[intendedRole].replace("/", "") || "customer"
    return NextResponse.redirect(new URL(`/${redirectPrefix}/login?error=EmailAlreadyUsedAsDifferentSeller`, request.url))
  }

  // If the user is already a verified customer, do not allow overwriting them into a seller.
  if (intendedRole !== UserRole.CUSTOMER && existingUser.role === UserRole.CUSTOMER && (existingUser.password !== null || existingUser.isEmailVerified === true)) {
    const redirectPrefix = ROLE_DEFAULT_NEXT[intendedRole].replace("/", "") || "customer"
    return NextResponse.redirect(new URL(`/${redirectPrefix}/login?error=EmailAlreadyUsedAsCustomer`, request.url))
  }

  if (intendedRole === UserRole.CUSTOMER && currentIsSeller) {
    return NextResponse.redirect(
      new URL(`/customer/login?error=EmailAlreadyUsedAsSeller&currentRole=${encodeURIComponent(existingUser.role)}`, request.url),
    )
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
    const seller = await prisma.seller.upsert({
      where: { userId },
      create: { userId, type: SellerType.PRODUCT },
      update: { type: SellerType.PRODUCT },
    })
    await activateFreePlan(seller.id)
  } else if (intendedRole === UserRole.SELLER_SERVICE) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.SELLER_SERVICE, isEmailVerified: true },
    })
    const seller = await prisma.seller.upsert({
      where: { userId },
      create: { userId, type: SellerType.SERVICE },
      update: { type: SellerType.SERVICE },
    })
    await activateFreePlan(seller.id)
  } else if (intendedRole === UserRole.SELLER_HOTEL) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.SELLER_HOTEL, isEmailVerified: true },
    })
    const hotelSeller = await prisma.hotelSeller.upsert({
      where: { userId },
      create: { userId },
      update: {},
    })
    await activateHotelFreePlan(hotelSeller.id)
  } else if (intendedRole === UserRole.SELLER_RESTAURANT) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.SELLER_RESTAURANT, isEmailVerified: true },
    })
    const restaurantSeller = await prisma.restaurantSeller.upsert({
      where: { userId },
      create: { userId },
      update: {},
    })
    await activateRestaurantFreePlan(restaurantSeller.id)
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
      ; (existingToken as any).role = intendedRole
      if (intendedRole === UserRole.CUSTOMER) {
        delete (existingToken as any).isApproved
        delete (existingToken as any).isSuspended
      } else {
        const isHospitality = intendedRole === UserRole.SELLER_HOTEL || intendedRole === UserRole.SELLER_RESTAURANT
        
        let seller: any = null
        if (intendedRole === UserRole.SELLER_HOTEL) {
          seller = await prisma.hotelSeller.findUnique({
            where: { userId },
            select: { isApproved: true, isSuspended: true, onboardingCompleted: true, onboardingStep: true },
          })
        } else if (intendedRole === UserRole.SELLER_RESTAURANT) {
          seller = await prisma.restaurantSeller.findUnique({
            where: { userId },
            select: { isApproved: true, isSuspended: true, onboardingCompleted: true, onboardingStep: true },
          })
        } else {
          seller = await prisma.seller.findUnique({
            where: { userId },
            select: { isApproved: true, isSuspended: true, onboardingCompleted: true, onboardingStep: true },
          })
        }

        ;(existingToken as any).isApproved = seller?.isApproved ?? false
        ;(existingToken as any).isSuspended = seller?.isSuspended ?? false
        ;(existingToken as any).onboardingCompleted = seller?.onboardingCompleted ?? false
        ;(existingToken as any).onboardingStep = seller?.onboardingStep ?? 2

        // Final safety: Override redirect URL if onboarding is not complete
        if (!seller?.onboardingCompleted) {
          const redirectPrefix = ROLE_DEFAULT_NEXT[intendedRole].replace("/", "") || "customer"
          redirectResponse = NextResponse.redirect(new URL(`/${redirectPrefix}/onboarding`, request.url))
        }
      }

      // Keep email in sync as well.
      if (session?.user?.email) {
        ; (existingToken as any).email = session.user.email
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

