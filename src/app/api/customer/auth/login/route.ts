import { NextResponse, NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { mergeGuestCartForUser } from "@/app/api/customer/cart/merge-logic"
import type { GuestCartItemForMerge } from "@/app/api/customer/cart/types"
import { POST as nextAuthPost } from "@/app/api/nextauth/[...nextauth]/route"

/** POST /api/customer/auth/login — Customer panel login. Proxies to NextAuth with role CUSTOMER. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, otpLoginToken, callbackUrl, csrfToken, guestCart } = body as {
      email?: string
      password?: string
      otpLoginToken?: string
      callbackUrl?: string
      csrfToken?: string
      guestCart?: unknown
    }
    const rawCallbackUrl = typeof callbackUrl === "string" ? callbackUrl : "/"
    const normalizedCallbackUrl = rawCallbackUrl === "/customer" ? "/" : rawCallbackUrl || "/"
    const hasOtpLoginToken = typeof otpLoginToken === "string" && otpLoginToken.trim().length > 0
    if (!email || (!password && !hasOtpLoginToken)) {
      return NextResponse.json(
        { error: "Email and password or OTP login token are required" },
        { status: 400 }
      )
    }
    const origin = new URL(request.url).origin
    const host = new URL(request.url).host
    const form = new URLSearchParams({
      email,
      password: hasOtpLoginToken ? "__OTP_LOGIN__" : (password as string),
      role: UserRole.CUSTOMER,
      callbackUrl: normalizedCallbackUrl,
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
    const isErrorRedirect = res.status === 302 && location.includes("error=")
    if (isErrorRedirect) {
      let msg = "Invalid email or password."
      try {
        const err = new URL(location, origin).searchParams.get("error")
        if (err === "MissingCSRF") msg = "Session expired. Please refresh and try again."
        else if (err === "CredentialsSignin") msg = "Invalid email or password."
        else if (err) msg = err
      } catch {
        /* use default msg */
      }
      return NextResponse.json({ error: msg }, { status: 401 })
    }
    const user = await prisma.user.findFirst({
      where: { email, role: UserRole.CUSTOMER },
      select: { id: true, isEmailVerified: true },
    })
    if (user && user.isEmailVerified === false) {
      const verifyUrl = `/customer/verify-otp?email=${encodeURIComponent(email)}`
      return NextResponse.json(
        { error: "Please verify your email first.", needsVerification: true, verifyUrl },
        { status: 403 }
      )
    }
    // On login success: merge guest cart into DB (customer only), then return
    if (user?.id && Array.isArray(guestCart) && guestCart.length > 0) {
      const items = guestCart.filter(
        (x: unknown): x is GuestCartItemForMerge =>
          x != null &&
          typeof x === "object" &&
          typeof (x as GuestCartItemForMerge).quantity === "number" &&
          (typeof (x as GuestCartItemForMerge).productId === "string" ||
            typeof (x as GuestCartItemForMerge).serviceId === "string")
      ) as GuestCartItemForMerge[]
      if (items.length > 0) await mergeGuestCartForUser(user.id, items)
    }
    if (res.status === 302) {
      const headers = new Headers()
      const normalizedLocation = location && location !== "/customer" ? location : normalizedCallbackUrl
      headers.set("Location", normalizedLocation)
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
    if (data?.url && data.url.includes("error=")) {
      let msg = "Invalid email or password."
      try {
        const u = new URL(data.url, origin)
        const err = u.searchParams.get("error")
        if (err === "MissingCSRF") msg = "Session expired. Please refresh and try again."
        else if (err === "CredentialsSignin") msg = "Invalid email or password."
        else if (err) msg = err
      } catch {
        /* use default msg */
      }
      return NextResponse.json({ error: msg }, { status: 401 })
    }
    const url = normalizedCallbackUrl
    const headers = new Headers()
    res.headers.getSetCookie?.().forEach((c) => headers.append("Set-Cookie", c))
    return NextResponse.json({ ...data, url }, { status: res.status, headers })
  } catch (error) {
    console.error("Customer login error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
