import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"

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
        else if (err === "CredentialsSignin") msg = "Invalid email or password."
        else if (err) msg = err
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
        const u = new URL(data.url, origin)
        const err = u.searchParams.get("error")
        if (err === "MissingCSRF") msg = "Session expired. Please refresh and try again."
        else if (err === "CredentialsSignin") msg = "Invalid email or password."
        else if (err) msg = err
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
