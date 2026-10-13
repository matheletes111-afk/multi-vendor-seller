import { NextResponse, NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { POST as nextAuthPost } from "@/app/api/nextauth/[...nextauth]/route"

/** POST /api/admin/auth/login — Admin panel login. Proxies to NextAuth with role ADMIN. */
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
    const proto =
      request.headers.get("x-forwarded-proto") ??
      (request.url.startsWith("https") ? "https" : "http")
    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      new URL(request.url).host
    const origin = `${proto}://${host}`

    let effectiveCsrfToken = csrfToken?.trim() || ""
    let cookie = request.headers.get("cookie") ?? ""

    const existingCsrfMatch = cookie.match(
      /(?:(?:__Host-)?authjs\.csrf-token|next-auth\.csrf-token)=([^;]+)/
    )
    if (existingCsrfMatch) {
      const rawVal = decodeURIComponent(existingCsrfMatch[1].trim())
      const tokenFromCookie = rawVal.split("|")[0]
      if (tokenFromCookie) {
        effectiveCsrfToken = tokenFromCookie
      }
    }

    if (cookie.includes("__Host-authjs.csrf-token=") && !cookie.includes("authjs.csrf-token=")) {
      const val = (cookie.match(/__Host-authjs\.csrf-token=([^;]+)/) || [])[1]
      if (val) cookie += `; authjs.csrf-token=${val}`
    } else if (cookie.includes("authjs.csrf-token=") && !cookie.includes("__Host-authjs.csrf-token=")) {
      const val = (cookie.match(/(?:^|;\s*)authjs\.csrf-token=([^;]+)/) || [])[1]
      if (val) cookie += `; __Host-authjs.csrf-token=${val}`
    }

    const form = new URLSearchParams({
      email,
      password,
      role: UserRole.ADMIN,
      callbackUrl: callbackUrl || "/admin",
      ...(effectiveCsrfToken && { csrfToken: effectiveCsrfToken }),
    })
    const nextauthRequest = new NextRequest(`${origin}/api/nextauth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
        "Host": host,
        "x-forwarded-proto": proto,
        "x-forwarded-host": host,
        ...(cookie && { Cookie: cookie }),
      },
      body: form.toString(),
    })
    const res = await nextAuthPost(nextauthRequest as any)
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
    const user = await prisma.user.findUnique({ where: { email }, select: { isEmailVerified: true } })
    if (user && user.isEmailVerified === false) {
      const verifyUrl = `/admin/verify-otp?email=${encodeURIComponent(email)}`
      return NextResponse.json(
        { error: "Please verify your email first.", needsVerification: true, verifyUrl },
        { status: 403 }
      )
    }
    if (res.status === 302) {
      const headers = new Headers()
      headers.set("Location", location || "/admin")
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
    const url = data?.url || callbackUrl || "/admin"
    const headers = new Headers()
    res.headers.getSetCookie?.().forEach((c) => headers.append("Set-Cookie", c))
    return NextResponse.json({ ...data, url }, { status: res.status, headers })
  } catch (error: any) {
    console.error("Admin login error:", error)
    return NextResponse.json(
      {
        error: "Internal server errors",
        log: error instanceof Error
          ? { message: error.message, name: error.name, stack: error.stack }
          : String(error)
      },
      { status: 500 }
    )
  }
}
