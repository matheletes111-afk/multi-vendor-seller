import { NextResponse, NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { POST as nextAuthPost } from "@/app/api/nextauth/[...nextauth]/route"
import { getFirstAllowedPath } from "@/lib/permissions"
import { normalizePhoneNumber } from "@/lib/twilio-sms"
import { getCandidateCountryCodePhonePairs } from "@/lib/phone-otp-lookup"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

/**
 * POST /api/backoffice/auth/login
 * Dedicated authentication endpoint for Backoffice Staff members.
 * Verifies staff status and computes the initial permitted landing route.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, otpLoginToken, csrfToken } = body

    if (!email || (!password && !otpLoginToken)) {
      return NextResponse.json(
        { error: "Email or phone and password or OTP token are required." },
        { status: 400 }
      )
    }

    const rawIdentifier = String(email).trim()
    const isEmail = rawIdentifier.includes("@")

    // 1. Verify user exists and has backoffice staff privileges
    let user: any = null

    if (isEmail) {
      user = await prisma.user.findFirst({
        where: { email: rawIdentifier.toLowerCase() },
        include: { backofficeRole: true },
      })
    } else {
      const normalizedPhone = normalizePhoneNumber(rawIdentifier)
      const phoneDigits = normalizedPhone.replace(/^\+/, "")
      const splitPairs = getCandidateCountryCodePhonePairs(normalizedPhone)
      const variants = getEquivalentPhoneVariants(rawIdentifier)

      user = await prisma.user.findFirst({
        where: {
          OR: [
            { isBackofficeUser: true },
            { role: UserRole.ADMIN },
          ],
          AND: [
            {
              OR: [
                { phone: { in: variants } },
                { phone: rawIdentifier },
                { phone: normalizedPhone },
                { phone: phoneDigits },
                ...splitPairs.map((pair) => ({
                  phoneCountryCode: pair.countryCode,
                  phone: pair.phone,
                })),
              ],
            },
          ],
        },
        include: { backofficeRole: true },
      })
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email/phone or password." },
        { status: 401 }
      )
    }

    // Reject non-backoffice roles (customers, sellers, riders)
    const isBackoffice = user.isBackofficeUser === true || user.role === UserRole.ADMIN
    if (!isBackoffice) {
      return NextResponse.json(
        { error: "Access Restricted: This login portal is strictly reserved for authorized Backoffice Staff." },
        { status: 403 }
      )
    }

    // Check if staff role is deactivated
    if (user.isBackofficeUser && user.backofficeRole && !user.backofficeRole.isActive) {
      return NextResponse.json(
        { error: "Account Suspended: Your assigned backoffice role has been deactivated. Please contact your platform administrator." },
        { status: 403 }
      )
    }

    // Compute intelligent landing page based on role permissions
    let permissions: string[] = []
    if (user.backofficeRole?.permissions) {
      try {
        permissions = Array.isArray(user.backofficeRole.permissions)
          ? (user.backofficeRole.permissions as string[])
          : JSON.parse((user.backofficeRole.permissions as string) || "[]")
      } catch {
        permissions = []
      }
    }

    const targetUrl = user.role === UserRole.ADMIN && !user.isBackofficeUser
      ? "/admin"
      : getFirstAllowedPath(permissions)

    // 2. Proxy credentials to NextAuth
    const origin = new URL(request.url).origin
    const host = new URL(request.url).host

    const form = new URLSearchParams({
      email: user.email || user.phone || rawIdentifier,
      ...(password ? { password } : {}),
      ...(otpLoginToken ? { otpLoginToken } : {}),
      role: UserRole.ADMIN,
      callbackUrl: body.callbackUrl || targetUrl,
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

    const headers = new Headers()
    res.headers.getSetCookie?.().forEach((c) => headers.append("Set-Cookie", c))

    return NextResponse.json(
      {
        success: true,
        redirectUrl: body.callbackUrl || targetUrl,
      },
      { status: 200, headers }
    )
  } catch (error: any) {
    console.error("Backoffice login error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process backoffice authentication." },
      { status: 500 }
    )
  }
}
