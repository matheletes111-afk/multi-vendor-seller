import { NextResponse, NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { POST as nextAuthPost } from "@/app/api/nextauth/[...nextauth]/route"
import { getSafeRedirectUrl } from "@/lib/safe-redirect"

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  SELLER_PRODUCT: "Product Seller",
  SELLER_SERVICE: "Service Seller",
  SELLER_HOTEL: "Hotel Seller",
  SELLER_RESTAURANT: "Restaurant Seller",
  ADMIN: "Admin",
}

/** POST /api/hotel-seller/auth/login — Hotel seller panel login. */
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

    const cleanEmail = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, password: true, role: true, isEmailVerified: true },
    })

    if (user) {
      // 1. Role mismatch check
      if (user.role !== UserRole.SELLER_HOTEL) {
        const label = ROLE_LABELS[user.role] || user.role
        return NextResponse.json(
          { error: `This email is registered as a ${label}. Please sign in using the ${label} login page.` },
          { status: 401 }
        )
      }

      // 2. Unverified email check
      if (user.isEmailVerified === false) {
        const verifyUrl = `/hotel-seller/verify-otp?email=${encodeURIComponent(cleanEmail)}`
        return NextResponse.json(
          { error: "Please verify your email first.", needsVerification: true, verifyUrl },
          { status: 403 }
        )
      }

      // 3. Suspended seller account check
      const seller = await prisma.hotelSeller.findUnique({
        where: { userId: user.id },
        select: { isSuspended: true },
      })
      if (seller?.isSuspended) {
        return NextResponse.json(
          { error: "Your seller account has been suspended. Please contact support." },
          { status: 403 }
        )
      }
    }

    const origin = new URL(request.url).origin
    const host = new URL(request.url).host
    const validatedCallbackUrl = getSafeRedirectUrl(callbackUrl, "/hotel-seller", origin)
    const form = new URLSearchParams({
      email: cleanEmail,
      password: hasOtpLoginToken ? "__OTP_LOGIN__" : (password as string),
      role: UserRole.SELLER_HOTEL,
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
        Host: host,
        ...(cookie && { Cookie: cookie }),
      },
      body: form.toString(),
    })
    const res = await nextAuthPost(nextauthRequest as any)
    const location = res.headers.get("Location") ?? ""
    const isErrorRedirect =
      res.status === 302 && (location.includes("error=") || location.includes("login"))

    if (isErrorRedirect) {
      let msg = "Invalid email or password."
      try {
        const err = new URL(location, origin).searchParams.get("error")
        if (err === "MissingCSRF") {
          msg = "Session expired. Please refresh and try again."
        } else if (err === "CredentialsSignin") {
          msg = "Invalid email or password."
        } else if (err) {
          msg = err
        }
      } catch {
        /* use default */
      }
      return NextResponse.json({ error: msg }, { status: 401 })
    }

    let url = getSafeRedirectUrl(location || callbackUrl, "/hotel-seller", origin)
    try {
      if (user?.role === UserRole.SELLER_HOTEL) {
        const s = await prisma.hotelSeller.findUnique({
          where: { userId: user.id },
          select: { onboardingCompleted: true },
        })
        if (s && !s.onboardingCompleted) {
          url = "/hotel-seller/onboarding"
        }
      }
    } catch {
      /* ignore */
    }

    const headers = new Headers()
    res.headers.getSetCookie?.().forEach((c: string) => headers.append("Set-Cookie", c))
    return NextResponse.json({ success: true, url }, { status: 200, headers })
  } catch (error) {
    console.error("Hotel seller login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
