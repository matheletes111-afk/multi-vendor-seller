import { NextResponse, NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { POST as nextAuthPost } from "@/app/api/nextauth/[...nextauth]/route"
import { getSafeRedirectUrl } from "@/lib/safe-redirect"

import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  SELLER_PRODUCT: "Product Seller",
  SELLER_SERVICE: "Service Seller",
  SELLER_HOTEL: "Hotel Seller",
  SELLER_RESTAURANT: "Restaurant Seller",
  ADMIN: "Admin",
}

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
    const rawIdentifier = (email || (body as any).phone || (body as any).identifier || "").trim()

    if (!rawIdentifier || (!password && !hasOtpLoginToken)) {
      return NextResponse.json(
        { error: "Email or mobile number, and password or OTP login token are required" },
        { status: 400 }
      )
    }

    const isEmail = rawIdentifier.includes("@")
    let user = null
    if (isEmail) {
      user = await prisma.user.findUnique({
        where: { email: rawIdentifier.toLowerCase() },
        select: { id: true, email: true, phone: true, password: true, role: true, isEmailVerified: true },
      })
    } else {
      const phoneVariants = getEquivalentPhoneVariants(rawIdentifier)
      user = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants } },
        select: { id: true, email: true, phone: true, password: true, role: true, isEmailVerified: true },
      })
    }

    // Check credentials / OTP validity BEFORE revealing role mismatch
    if (user) {
      let isCredentialsValid = false
      if (hasOtpLoginToken) {
        isCredentialsValid = true
      } else if (user.password && password) {
        isCredentialsValid = await bcrypt.compare(password, user.password)
      }

      if (isCredentialsValid) {
        // 1. Role mismatch check (only if credentials are valid)
        if (user.role !== UserRole.SELLER_PRODUCT) {
          const label = ROLE_LABELS[user.role] || user.role
          return NextResponse.json(
            { error: `This account is registered as a ${label}. Please sign in using the ${label} login page.` },
            { status: 401 }
          )
        }

        // 2. Unverified account check
        if (user.isEmailVerified === false) {
          const verifyParam = user.email ? `email=${encodeURIComponent(user.email)}` : `phone=${encodeURIComponent(user.phone || rawIdentifier)}`
          const verifyUrl = `/product-seller/verify-otp?${verifyParam}`
          return NextResponse.json(
            { error: "Please verify your account first.", needsVerification: true, verifyUrl },
            { status: 403 }
          )
        }

        // 3. Suspended seller account check
        const seller = await prisma.seller.findUnique({
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
    }

    const origin = new URL(request.url).origin
    const host = new URL(request.url).host
    const validatedCallbackUrl = getSafeRedirectUrl(callbackUrl, "/product-seller", origin)
    const form = new URLSearchParams({
      email: rawIdentifier,
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
        Host: host,
        ...(cookie && { Cookie: cookie }),
      },
      body: form.toString(),
    })
    const res = await nextAuthPost(nextauthRequest as any)

    // Auth.js (NextAuth v5) with X-Auth-Return-Redirect:1 returns 200+JSON {url:"..."}
    // instead of a 302 Location redirect when auth fails. Handle both.
    const location = res.headers.get("Location") ?? ""
    let nextAuthUrl = location
    if (!nextAuthUrl) {
      try {
        const body = await res.clone().json().catch(() => ({}))
        nextAuthUrl = typeof body?.url === "string" ? body.url : ""
      } catch { /* ignore */ }
    }

    const isErrorRedirect = nextAuthUrl.includes("error=") || nextAuthUrl.includes("login") || nextAuthUrl.includes("registration")

    if (isErrorRedirect) {
      let msg = "Invalid email, mobile number, or password."
      try {
        const err = new URL(nextAuthUrl, origin).searchParams.get("error")
        if (err === "MissingCSRF") {
          msg = "Session expired. Please refresh and try again."
        } else if (err === "CredentialsSignin") {
          msg = "Invalid email, mobile number, or password."
        } else if (err) {
          msg = err
        }
      } catch {
        /* use default */
      }
      return NextResponse.json({ error: msg }, { status: 401 })
    }

    let url = getSafeRedirectUrl(nextAuthUrl || callbackUrl, "/product-seller", origin)
    try {
      if (user?.role === UserRole.SELLER_PRODUCT) {
        const s = await prisma.seller.findUnique({
          where: { userId: user.id },
          select: { onboardingCompleted: true },
        })
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
