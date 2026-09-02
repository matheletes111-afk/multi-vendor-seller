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
  RIDER: "Delivery Rider",
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, callbackUrl, csrfToken } = body as {
      email?: string
      password?: string
      callbackUrl?: string
      csrfToken?: string
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, password: true, role: true, isEmailVerified: true },
    })

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    // Role check
    if (user.role !== UserRole.RIDER) {
      const label = ROLE_LABELS[user.role] || user.role
      return NextResponse.json(
        { error: `This email is registered as a ${label}. Please sign in using the ${label} login portal.` },
        { status: 401 }
      )
    }

    // Email verification check
    if (user.isEmailVerified === false) {
      return NextResponse.json(
        { error: "Please verify your email address before logging in.", needsVerification: true },
        { status: 403 }
      )
    }

    // Rider suspension check
    const rider = await prisma.rider.findUnique({
      where: { userId: user.id },
      select: { isSuspended: true, status: true, onboardingCompleted: true, isFirstLogin: true },
    })

    if (rider && (rider.isSuspended || rider.status === "SUSPENDED")) {
      return NextResponse.json(
        { error: "Your rider account has been suspended. Please contact support." },
        { status: 403 }
      )
    }

    const origin = new URL(request.url).origin
    const host = request.headers.get("host") ?? new URL(request.url).host
    const validatedCallbackUrl = getSafeRedirectUrl(callbackUrl, "/riderapp", origin)
    const form = new URLSearchParams({
      email: cleanEmail,
      password: password as string,
      role: UserRole.RIDER,
      callbackUrl: validatedCallbackUrl,
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

    const nextauthResponse = await nextAuthPost(nextauthRequest as any)

    const location = nextauthResponse.headers.get("Location") ?? ""
    let nextAuthUrl = location
    if (!nextAuthUrl) {
      try {
        const resBody = await nextauthResponse.clone().json().catch(() => ({}))
        nextAuthUrl = typeof resBody?.url === "string" ? resBody.url : ""
      } catch {
        /* ignore */
      }
    }

    const isErrorRedirect =
      nextAuthUrl.includes("error=") ||
      nextAuthUrl.includes("login") ||
      nextAuthUrl.includes("registration")

    if (isErrorRedirect) {
      let msg = "Invalid email or password."
      try {
        const err = new URL(nextAuthUrl, origin).searchParams.get("error")
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

    const targetUrl =
      rider?.isFirstLogin || !rider?.onboardingCompleted
        ? "/riderapp/onboarding"
        : getSafeRedirectUrl(nextAuthUrl || callbackUrl, "/riderapp", origin)

    const headers = new Headers()
    nextauthResponse.headers.getSetCookie?.().forEach((c: string) => headers.append("Set-Cookie", c))

    return NextResponse.json(
      {
        success: true,
        url: targetUrl,
        isFirstLogin: rider?.isFirstLogin ?? true,
        onboardingCompleted: rider?.onboardingCompleted ?? false,
      },
      { status: 200, headers }
    )
  } catch (error) {
    console.error("Rider login API error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred during login. Please try again." },
      { status: 500 }
    )
  }
}
