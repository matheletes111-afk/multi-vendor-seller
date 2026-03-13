import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

/** POST /api/product-seller/auth/login — Product seller panel login. Proxies to NextAuth with role SELLER_PRODUCT. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, callbackUrl, csrfToken } = body
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    // 1) Email verified first → redirect to OTP (sellers only). Admin approval is enforced at panel level via middleware.
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true, role: true, isEmailVerified: true },
    })
    if (
      user?.role === UserRole.SELLER_PRODUCT &&
      user.password &&
      (await bcrypt.compare(password, user.password))
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
    const form = new URLSearchParams({
      email,
      password,
      role: UserRole.SELLER_PRODUCT,
      callbackUrl: callbackUrl || "/product-seller",
      ...(csrfToken && { csrfToken }),
    })
    const cookie = request.headers.get("cookie") ?? ""
    const res = await fetch(`${origin}/api/nextauth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
        ...(cookie && { Cookie: cookie }),
      },
      body: form.toString(),
      redirect: "manual",
    })
    const location = res.headers.get("Location") ?? ""
    const isErrorRedirect =
      res.status === 302 &&
      (location.includes("error=") ||
        location.includes("customer/login") ||
        location.includes("customer/registration"))
    if (isErrorRedirect) {
      let msg = "Invalid email or password."
      try {
        const err = new URL(location, origin).searchParams.get("error")
        if (err === "MissingCSRF") msg = "Session expired. Please refresh and try again."
        else if (err === "CredentialsSignin") {
          // Show proper message: 1) email not verified → OTP, 2) suspended
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
    if (res.status === 302) {
      const headers = new Headers()
      headers.set("Location", location || "/product-seller")
      res.headers.getSetCookie?.().forEach((c) => headers.append("Set-Cookie", c))
      return new NextResponse(null, { status: 302, headers })
    }
    const text = await res.text()
    let data: { url?: string } = {}
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }
    if (data?.url && (data.url.includes("error=") || data.url.includes("customer/login") || data.url.includes("customer/registration"))) {
      let msg = "Invalid email or password."
      try {
        const url = new URL(data.url, origin)
        const err = url.searchParams.get("error")
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
    const url = data?.url || callbackUrl || "/product-seller"
    const headers = new Headers()
    res.headers.getSetCookie?.().forEach((c) => headers.append("Set-Cookie", c))
    return NextResponse.json({ ...data, url }, { status: res.status, headers })
  } catch (error) {
    console.error("Product seller login error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
