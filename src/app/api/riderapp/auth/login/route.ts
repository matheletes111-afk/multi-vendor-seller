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
    const host = new URL(request.url).host
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
        cookie,
        host,
        "x-forwarded-host": host,
        "x-forwarded-proto": new URL(request.url).protocol.replace(":", ""),
        "X-Auth-Return-Redirect": "1",
      },
      body: form.toString(),
    })

    const nextauthResponse = await nextAuthPost(nextauthRequest)

    if (nextauthResponse.status === 401) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    const resContentType = nextauthResponse.headers.get("content-type") ?? ""
    if (resContentType.includes("application/json")) {
      const data = await nextauthResponse.json()
      const rawUrl = data?.url ?? validatedCallbackUrl
      const finalUrl = getSafeRedirectUrl(rawUrl, "/riderapp", origin)
      const res = NextResponse.json({
        success: true,
        url: finalUrl,
        isFirstLogin: rider?.isFirstLogin ?? true,
        onboardingCompleted: rider?.onboardingCompleted ?? false,
      })
      nextauthResponse.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") {
          res.headers.append("set-cookie", value)
        }
      })
      return res
    }

    const locationHeader = nextauthResponse.headers.get("location")
    if (locationHeader) {
      const finalUrl = getSafeRedirectUrl(locationHeader, "/riderapp", origin)
      const res = NextResponse.json({
        success: true,
        url: finalUrl,
        isFirstLogin: rider?.isFirstLogin ?? true,
        onboardingCompleted: rider?.onboardingCompleted ?? false,
      })
      nextauthResponse.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") {
          res.headers.append("set-cookie", value)
        }
      })
      return res
    }

    return NextResponse.json({ success: true, url: validatedCallbackUrl })
  } catch (error) {
    console.error("Rider login API error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred during login. Please try again." },
      { status: 500 }
    )
  }
}
