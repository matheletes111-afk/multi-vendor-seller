import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { normalizePhoneNumber } from "@/lib/twilio-sms"
import { getEquivalentPhoneVariants } from "@/lib/phone-validation"

const TWILIO_ERROR_DESCRIPTIONS: Record<string, string> = {
  "30001": "Queue overflow: Twilio queue limit exceeded.",
  "30002": "Account suspended: Twilio account suspended.",
  "30003": "Handset unreachable: Mobile device is powered off, out of coverage, or unable to receive SMS.",
  "30004": "Blocked by recipient: Number is blocked on recipient device or blacklist.",
  "30005": "Unknown destination handset: Destination number is inactive, invalid, or disconnected.",
  "30006": "Landline or unreachable carrier: Number is landline or mobile carrier does not accept SMS.",
  "30007": "Carrier Violation: Carrier spam filter blocked the message (often due to raw URLs, marketing words, or unverified sender ID).",
  "30008": "Unknown carrier failure: Upstream telecom partner reported delivery failure.",
  "30009": "Missing segment: Concatenated multi-part SMS failed to reassemble.",
  "30010": "Price exceeds max price: Twilio blocked due to route pricing.",
  "30023": "Daily cap reached: Twilio daily messaging limit exceeded.",
}

/**
 * Normalizes user input into E.164 and local digits
 */
function resolvePhoneFormats(input: string, countryCode: string = "+232") {
  const normalized = normalizePhoneNumber(input, countryCode)
  const digits = input.replace(/\D/g, "")
  const localDigits = digits.startsWith("232") ? digits.slice(3).replace(/^0+/, "") : digits.replace(/^0+/, "")

  return {
    normalized,
    digits,
    localDigits,
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawPhone =
      searchParams.get("phone") ||
      searchParams.get("number") ||
      searchParams.get("to") ||
      searchParams.get("msisdn") ||
      ""

    const countryCode = searchParams.get("countryCode") || searchParams.get("cc") || "+232"

    const accountSid =
      process.env.ACC_SID_TWILIO?.trim() ||
      process.env.TWILIO_ACCOUNT_SID?.trim() ||
      ""
    const authToken =
      process.env.AUTH_TOKEN_TWILIO?.trim() ||
      process.env.TWILIO_AUTH_TOKEN?.trim() ||
      ""

    if (!rawPhone.trim()) {
      // If no phone parameter provided, fetch the 10 most recent SMS sent across all numbers from Twilio
      if (accountSid && authToken) {
        const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?PageSize=10`
        const twilioRes = await fetch(twilioUrl, {
          headers: { Authorization: `Basic ${basicAuth}` },
        })
        const twilioData = await twilioRes.json().catch(() => null)
        const recentMessages = (twilioData?.messages || []).map((m: any) => ({
          sid: m.sid,
          to: m.to,
          from: m.from,
          status: m.status,
          dateSent: m.date_sent || m.date_created,
          body: m.body,
          errorCode: m.error_code,
          errorMessage: m.error_message,
        }))

        return NextResponse.json({
          message: "SMS Status Diagnostic API. Provide ?phone=... to inspect a specific number.",
          usage: "GET /api/sms-status?phone=+23273322550 or /api/sms-status?phone=073322550",
          recentOutboundSms: recentMessages,
        })
      }

      return NextResponse.json({
        message: "SMS Status Diagnostic API. Provide ?phone=... to inspect a specific number.",
        usage: "GET /api/sms-status?phone=+23273322550",
      })
    }

    const { normalized, digits, localDigits } = resolvePhoneFormats(rawPhone, countryCode)

    // 1. Query Database for user with this phone number
    const phoneVariants = getEquivalentPhoneVariants(localDigits || digits || rawPhone, countryCode)
    if (normalized && !phoneVariants.includes(normalized)) {
      phoneVariants.push(normalized)
    }

    const dbUsers = await prisma.user.findMany({
      where: {
        OR: [
          { phone: { in: phoneVariants } },
          { phone: { contains: localDigits || digits } },
        ],
      },
      select: {
        id: true,
        name: true,
        role: true,
        phone: true,
        phoneCountryCode: true,
        email: true,
        isEmailVerified: true,
        verifyEmailOtp: true,
        emailVerificationExpires: true,
        emailOtpSentAt: true,
        loginOtp: true,
        loginOtpExpires: true,
        loginOtpSentAt: true,
        createdAt: true,
        updatedAt: true,
        seller: {
          select: {
            id: true,
            type: true,
            status: true,
            isApproved: true,
            onboardingStep: true,
          },
        },
      },
    })

    const userSummary = dbUsers.map((u) => {
      const now = new Date()
      const isOtpExpired = u.emailVerificationExpires ? now > u.emailVerificationExpires : null
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        phone: u.phone,
        phoneCountryCode: u.phoneCountryCode,
        email: u.email,
        isEmailVerified: u.isEmailVerified,
        currentVerificationOtp: u.verifyEmailOtp,
        otpExpires: u.emailVerificationExpires,
        isOtpExpired,
        otpSentAt: u.emailOtpSentAt,
        loginOtp: u.loginOtp,
        loginOtpExpires: u.loginOtpExpires,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        seller: u.seller,
      }
    })

    // 2. Query Twilio API for SMS history to this number
    let twilioResult: any = {
      configured: false,
      queryNumber: normalized,
      messages: [],
    }

    if (accountSid && authToken) {
      twilioResult.configured = true
      const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")

      // Fetch messages for normalized number (+232...)
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?To=${encodeURIComponent(
        normalized
      )}&PageSize=20`

      const twilioRes = await fetch(twilioUrl, {
        headers: { Authorization: `Basic ${basicAuth}` },
      })

      const twilioData = await twilioRes.json().catch(() => null)

      if (twilioRes.ok && twilioData?.messages) {
        twilioResult.totalFound = twilioData.messages.length
        twilioResult.latestStatus = twilioData.messages[0]?.status ?? "none"
        twilioResult.messages = twilioData.messages.map((m: any) => {
          const errCodeStr = m.error_code ? String(m.error_code) : null
          const explanation = errCodeStr
            ? TWILIO_ERROR_DESCRIPTIONS[errCodeStr] || `Twilio carrier error ${errCodeStr}`
            : m.status === "delivered"
            ? "Delivered successfully to handset."
            : m.status === "sent"
            ? "Dispatched by Twilio and acknowledged by mobile carrier."
            : m.status === "queued" || m.status === "sending"
            ? "In transit or queued for dispatch."
            : `Status: ${m.status}`

          return {
            sid: m.sid,
            dateCreated: m.date_created,
            dateSent: m.date_sent,
            status: m.status,
            to: m.to,
            from: m.from,
            body: m.body,
            errorCode: m.error_code,
            errorMessage: m.error_message,
            explanation,
          }
        })
      } else {
        twilioResult.error = twilioData?.message || `Twilio returned HTTP ${twilioRes.status}`
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      query: {
        raw: rawPhone,
        normalized,
        localDigits,
      },
      database: {
        totalUsersMatched: userSummary.length,
        users: userSummary,
      },
      twilio: twilioResult,
    })
  } catch (error: any) {
    console.error("[SMS Status Route Error]:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to inspect SMS status.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  // Support POST as well (json body: { phone: "..." })
  try {
    const body = await request.json().catch(() => ({}))
    const rawPhone = body.phone || body.number || body.to || ""
    const countryCode = body.countryCode || body.country_code || "+232"

    const url = new URL(request.url)
    if (rawPhone) {
      url.searchParams.set("phone", rawPhone)
      if (countryCode) url.searchParams.set("countryCode", countryCode)
    }

    return GET(new Request(url.toString(), { headers: request.headers }))
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Invalid request" }, { status: 400 })
  }
}
