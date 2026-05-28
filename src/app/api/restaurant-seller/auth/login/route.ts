import { NextResponse, NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { POST as nextAuthPost } from "@/app/api/nextauth/[...nextauth]/route"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, otpLoginToken, callbackUrl, csrfToken } = body
    const hasOtpLoginToken = typeof otpLoginToken === "string" && otpLoginToken.trim().length > 0
    
    if (!email || (!password && !hasOtpLoginToken)) {
      return NextResponse.json({ error: "Credentials required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true, role: true, isEmailVerified: true },
    })

    if (!hasOtpLoginToken && user?.role === UserRole.SELLER_RESTAURANT && user.password && (await bcrypt.compare(password, user.password))) {
      if (user.isEmailVerified === false) {
        return NextResponse.json({ error: "Verify email.", needsVerification: true, verifyUrl: `/restaurant-seller/verify-otp?email=${encodeURIComponent(email)}` }, { status: 403 })
      }
    }

    const origin = new URL(request.url).origin
    const host = new URL(request.url).host
    const form = new URLSearchParams({
      email,
      password: hasOtpLoginToken ? "__OTP_LOGIN__" : password,
      role: UserRole.SELLER_RESTAURANT,
      callbackUrl: callbackUrl || "/restaurant-seller",
      ...(hasOtpLoginToken ? { otpLoginToken: otpLoginToken.trim() } : {}),
      ...(csrfToken && { csrfToken }),
    })
    
    const cookie = request.headers.get("cookie") ?? ""
    const nextauthRequest = new NextRequest(`${origin}/api/nextauth/callback/credentials`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded", 
        "X-Auth-Return-Redirect": "1", 
        "Host": host,
        ...(cookie && { Cookie: cookie }) 
      },
      body: form.toString(),
    })
    const res = await nextAuthPost(nextauthRequest as any)
    
    const location = res.headers.get("Location") ?? ""
    if (res.status === 302 && (location.includes("error=") || location.includes("login"))) {
        const u = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, isEmailVerified: true } })
        if (u?.role === UserRole.SELLER_RESTAURANT) {
            if (u.isEmailVerified === false) return NextResponse.json({ error: "Verify email.", needsVerification: true, verifyUrl: `/restaurant-seller/verify-otp?email=${encodeURIComponent(email)}` }, { status: 403 })
            const s = await prisma.restaurantSeller.findUnique({ where: { userId: u.id }, select: { isSuspended: true } })
            if (s?.isSuspended) return NextResponse.json({ error: "Account suspended." }, { status: 403 })
        }
        return NextResponse.json({ error: "Invalid credentials." }, { status: 401 })
    }

    if (res.status === 302) {
      const headers = new Headers()
      headers.set("Location", location || "/restaurant-seller")
      res.headers.getSetCookie?.().forEach((c) => headers.append("Set-Cookie", c))
      return new NextResponse(null, { status: 302, headers })
    }

    const data = await res.json().catch(() => ({}))
    let url = data?.url || callbackUrl || "/restaurant-seller"
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
    if (u?.role === UserRole.SELLER_RESTAURANT) {
      const s = await prisma.restaurantSeller.findUnique({ where: { userId: u.id }, select: { onboardingCompleted: true } })
      if (s && !s.onboardingCompleted) url = "/restaurant-seller/onboarding"
    }

    const headers = new Headers()
    res.headers.getSetCookie?.().forEach((c) => headers.append("Set-Cookie", c))
    return NextResponse.json({ ...data, url }, { status: res.status, headers })
  } catch (error) {
    console.error("Restaurant login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
