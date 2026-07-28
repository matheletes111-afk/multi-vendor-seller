import { NextResponse, NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { POST as nextAuthPost } from "@/app/api/nextauth/[...nextauth]/route"
import { getSafeRedirectUrl } from "@/lib/safe-redirect"

/** Result type when selecting id, password, role, isEmailVerified. Schema has isEmailVerified; Prisma client types may be out of sync. */
type UserLoginRow = { id: string; password: string | null; role: UserRole; isEmailVerified: boolean }

/** POST /api/service-seller/auth/login — Service seller panel login. Proxies to NextAuth with role SELLER_SERVICE. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, otpLoginToken, callbackUrl, csrfToken } = body as {
      email?: string
      password?: string
      otpLoginToken?: string
      callbackUrl?: string
      csrfToken?: string
    }
    const hasOtpLoginToken = typeof otpLoginToken === "string" && otpLoginToken.trim().length > 0
    if (!email || (!password && !hasOtpLoginToken)) {
      return NextResponse.json(
        { error: "Email and password or OTP login token are required" },
        { status: 400 }
      )
    }

    // 1) Email verified first → redirect to OTP (sellers only). Admin approval is enforced at panel level via middleware.
    const user = (await prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true, role: true, isEmailVerified: true } as { id: true; password: true; role: true; isEmailVerified: true },
    })) as UserLoginRow | null
    if (
      !hasOtpLoginToken &&
      user?.role === UserRole.SELLER_SERVICE &&
      user.password &&
      (await bcrypt.compare(password as string, user.password))
    ) {
      // Email not verified → send to OTP page
      if (user.isEmailVerified === false) {
        const verifyUrl = `/service-seller/verify-otp?email=${encodeURIComponent(email)}`
        return NextResponse.json(
          { error: "Please verify your email first.", needsVerification: true, verifyUrl },
          { status: 403 }
        )
      }
    }

    const origin = new URL(request.url).origin
    const host = new URL(request.url).host
    const validatedCallbackUrl = getSafeRedirectUrl(callbackUrl, "/service-seller", origin)
    const form = new URLSearchParams({
      email,
      password: hasOtpLoginToken ? "__OTP_LOGIN__" : (password as string),
      role: UserRole.SELLER_SERVICE,
      callbackUrl: validatedCallbackUrl,
      ...(hasOtpLoginToken ? { otpLoginToken: otpLoginToken!.trim() } : {}),
      ...(csrfToken && { csrfToken }),
    })
    const cookie = request.headers.get("cookie") ?? ""
    const nextauthRequest = new NextRequest(`${origin}/api/nextauth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
        "Host": host,
        ...(cookie && { Cookie: cookie }),
      },
      body: form.toString(),
    })
    const res = await nextAuthPost(nextauthRequest as any)
    const location = res.headers.get("Location") ?? ""
    const isErrorRedirect =
      res.status === 302 &&
      (location.includes("error=") ||
        location.includes("login") ||
        location.includes("registration"))
    if (isErrorRedirect) {
      let msg = "Invalid email or password."
      try {
        const err = new URL(location, origin).searchParams.get("error")
        if (err === "MissingCSRF") {
          msg = "Session expired. Please refresh and try again."
        } else if (err === "CredentialsSignin") {
          const u = (await prisma.user.findUnique({
            where: { email },
            select: { id: true, role: true, isEmailVerified: true } as { id: true; role: true; isEmailVerified: true },
          })) as UserLoginRow | null
          if (!u) {
            msg = "Invalid email or password."
          } else if (u.role !== UserRole.SELLER_SERVICE) {
            const roleLabels: Record<string, string> = {
              CUSTOMER: "Customer",
              SELLER_PRODUCT: "Product Seller",
              SELLER_HOTEL: "Hotel Seller",
              SELLER_RESTAURANT: "Restaurant Seller",
              ADMIN: "Admin",
            }
            const label = roleLabels[u.role] || u.role
            msg = `This email is registered as a ${label}. Please sign in using the ${label} login page.`
          } else if (u.isEmailVerified === false) {
            const verifyUrl = `/service-seller/verify-otp?email=${encodeURIComponent(email)}`
            return NextResponse.json(
              { error: "Please verify your email first.", needsVerification: true, verifyUrl },
              { status: 403 }
            )
          } else {
            const s = await prisma.seller.findUnique({
              where: { userId: u.id },
              select: { isSuspended: true },
            })
            if (s?.isSuspended) {
              return NextResponse.json(
                { error: "Your account has been suspended. Please contact support." },
                { status: 403 }
              )
            }
            msg = "Invalid email or password."
          }
        } else if (err) {
          msg = err
        }
      } catch {
        /* use default msg */
      }
      return NextResponse.json({ error: msg }, { status: 401 })
    }

    let url = getSafeRedirectUrl(location || callbackUrl, "/service-seller", origin)

    // Final safety: check if onboarding is needed and force URL if so.
    try {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
      if (u?.role === UserRole.SELLER_SERVICE) {
        const s = await prisma.seller.findUnique({ where: { userId: u.id }, select: { onboardingCompleted: true } })
        if (s && !s.onboardingCompleted) {
          url = "/service-seller/onboarding"
        }
      }
    } catch {
      /* ignore */
    }

    const headers = new Headers()
    res.headers.getSetCookie?.().forEach((c: string) => headers.append("Set-Cookie", c))
    return NextResponse.json({ success: true, url }, { status: 200, headers })
  } catch (error) {
    console.error("Service seller login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
