import { NextResponse, NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { POST as nextAuthPost } from "@/app/api/nextauth/[...nextauth]/route"
import { getSafeRedirectUrl } from "@/lib/safe-redirect"


/** POST /api/product-seller/auth/login — Product seller panel login. Proxies to NextAuth with role SELLER_PRODUCT. */
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
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true, role: true, isEmailVerified: true },
    })
    if (
      !hasOtpLoginToken &&
      user?.role === UserRole.SELLER_PRODUCT &&
      user.password &&
      (await bcrypt.compare(password as string, user.password))
    ) {
      // Email not verified → send to OTP page
      if (user.isEmailVerified === false) {
        const verifyUrl = `/product-seller/verify-otp?email=${encodeURIComponent(email)}`
        return NextResponse.json(
          { error: "Please verify your email first.", needsVerification: true, verifyUrl },
          { status: 403 }
        )
      }
    }

    const origin = new URL(request.url).origin
    const host = new URL(request.url).host
    const validatedCallbackUrl = getSafeRedirectUrl(callbackUrl, "/product-seller", origin)
    const form = new URLSearchParams({
      email,
      password: hasOtpLoginToken ? "__OTP_LOGIN__" : (password as string),
      role: UserRole.SELLER_PRODUCT,
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
        if (err === "MissingCSRF") msg = "Session expired. Please refresh and try again."
        else if (err === "CredentialsSignin") {
          const u = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, isEmailVerified: true } })
          if (u?.role === UserRole.SELLER_PRODUCT) {
            if (u.isEmailVerified === false) {
              const verifyUrl = `/product-seller/verify-otp?email=${encodeURIComponent(email)}`
              return NextResponse.json({ error: "Please verify your email first.", needsVerification: true, verifyUrl }, { status: 403 })
            }
            const s = await prisma.seller.findUnique({ where: { userId: u.id }, select: { isSuspended: true } })
            if (s?.isSuspended) return NextResponse.json({ error: "Your account has been suspended. Please contact support." }, { status: 403 })
          }
          msg = "Invalid email or password."
        } else if (err) msg = err
      } catch {
        /* use default */
      }
      return NextResponse.json({ error: msg }, { status: 401 })
    }
    let url = getSafeRedirectUrl(location || callbackUrl, "/product-seller", origin)

    // Final safety: check if onboarding is needed and force URL if so.
    try {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
      if (u?.role === UserRole.SELLER_PRODUCT) {
        const s = await prisma.seller.findUnique({ where: { userId: u.id }, select: { onboardingCompleted: true } })
        if (s && !s.onboardingCompleted) {
          url = "/product-seller/onboarding"
        }
      }
    } catch {
      /* ignore */
    }

    const headers = new Headers()
    res.headers.getSetCookie?.().forEach((c: string) => headers.append("Set-Cookie", c))
    return NextResponse.json({ success: true, url }, { status: 200, headers })
  } catch (error) {
    console.error("Product seller login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
