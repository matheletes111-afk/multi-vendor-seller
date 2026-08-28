type SendSmsInput = {
  to: string
  body: string
}

/** Twilio Account SID */
const TWILIO_ACCOUNT_SID = process.env.ACC_SID_TWILIO?.trim() ?? ""
const TWILIO_AUTH_TOKEN = process.env.AUTH_TOKEN_TWILIO?.trim() ?? ""
/** Optional: legacy SMS from a single Twilio number */
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER?.trim() ?? ""
/**
 * Twilio Messaging Service SID (MG…). When set, SMS is sent via the Messaging Service
 * (no TWILIO_PHONE_NUMBER / From required). Matches Twilio SDK: messagingServiceSid.
 */
const TWILIO_MESSAGING_SERVICE_SID = process.env.MSG_SERVICESID?.trim() ?? ""

export function normalizePhoneNumber(input: string, defaultCountryCode: string = "+232"): string {
  const trimmed = input.trim()
  if (!trimmed) return ""
  const clean = trimmed.replace(/[\s\-().,/_]/g, "")
  const hasPlus = clean.startsWith("+")
  const digits = clean.replace(/\D/g, "")
  if (!digits) return ""

  if (hasPlus) {
    // If entered as +232088994462, check 1 to 3 digit country codes and remove the leading 0 after CC
    for (let ccLen = 1; ccLen <= 3; ccLen++) {
      if (digits.length > ccLen + 6) {
        const cc = digits.slice(0, ccLen)
        const rest = digits.slice(ccLen)
        if (rest.startsWith("0")) {
          return `+${cc}${rest.replace(/^0+/, "")}`
        }
      }
    }
    return `+${digits}`
  }

  // If entered with country code but no + (e.g. 232088994462 or 23288994462 or 919876543210):
  if (!digits.startsWith("0") && digits.length >= 10) {
    for (let ccLen = 1; ccLen <= 3; ccLen++) {
      if (digits.length > ccLen + 6) {
        const cc = digits.slice(0, ccLen)
        const rest = digits.slice(ccLen)
        if (rest.startsWith("0")) {
          return `+${cc}${rest.replace(/^0+/, "")}`
        }
      }
    }
    return `+${digits}`
  }

  // If entered as a local number with leading zero (e.g. 088994462 / 076123456):
  const ccDigits = defaultCountryCode.replace(/\D/g, "")
  if (digits.startsWith("0")) {
    const withoutZero = digits.replace(/^0+/, "")
    return `+${ccDigits}${withoutZero}`
  }

  // If entered as 8-digit local number without leading zero (e.g. 88994462):
  if (digits.length <= 9) {
    return `+${ccDigits}${digits}`
  }

  return `+${digits}`
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone)
}

export async function sendSmsViaTwilio({ to, body }: SendSmsInput): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio ACC_SID_TWILIO and AUTH_TOKEN_TWILIO are required.")
  }
  if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_PHONE_NUMBER) {
    throw new Error(
      "Set MSG_SERVICESID (Messaging Service SID, MG…) or TWILIO_PHONE_NUMBER (legacy From number)."
    )
  }

  const params = new URLSearchParams({ To: to, Body: body })
  if (TWILIO_MESSAGING_SERVICE_SID) {
    params.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID)
  } else {
    params.set("From", TWILIO_PHONE_NUMBER)
  }

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const data = await res.text().catch(() => "")
    throw new Error(`Twilio SMS failed: ${res.status} ${data}`)
  }
}

export function getAppBaseUrl(request?: Request | { headers: Headers | { get(name: string): string | null }; url?: string }): string {
  if (request) {
    try {
      const headers = "headers" in request ? request.headers : undefined
      const forwardedProto = headers?.get?.("x-forwarded-proto") || "https"
      const forwardedHost = headers?.get?.("x-forwarded-host") || headers?.get?.("host")
      if (forwardedHost) {
        return `${forwardedProto}://${forwardedHost}`
      }
      if ("url" in request && request.url) {
        const url = new URL(request.url)
        return url.origin
      }
    } catch {}
  }
  return (
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://meeem.com"
  )
}

export function formatFullPhoneNumber(phone?: string | null, countryCode?: string | null): string {
  if (!phone) return ""
  let cleanPhone = phone.trim()
  if (cleanPhone.startsWith("+")) {
    return normalizePhoneNumber(cleanPhone)
  }
  const cleanDigits = cleanPhone.replace(/\D/g, "")
  if (!cleanDigits) return ""

  if (countryCode) {
    let cleanCode = countryCode.trim()
    const codeDigits = cleanCode.replace(/\D/g, "")
    if (!codeDigits) {
      return `+${cleanDigits.replace(/^0+/, "")}`
    }
    cleanCode = `+${codeDigits}`

    // If phone already starts with code digits (e.g. 232088994462 or 23288994462)
    if (cleanDigits.startsWith(codeDigits) && cleanDigits.length >= codeDigits.length + 6) {
      const rest = cleanDigits.slice(codeDigits.length).replace(/^0+/, "")
      return `${cleanCode}${rest}`
    }

    // Remove leading zeros from phone if any
    const phoneNoLeadingZero = cleanDigits.replace(/^0+/, "")
    return `${cleanCode}${phoneNoLeadingZero}`
  }

  return `+${cleanDigits.replace(/^0+/, "")}`
}

export async function sendEmailVerificationSms({
  to,
  countryCode,
  verificationLink,
  otp,
  name,
}: {
  to?: string | null
  countryCode?: string | null
  verificationLink?: string
  otp?: string
  name?: string | null
}): Promise<void> {
  const fullPhone = formatFullPhoneNumber(to, countryCode)
  if (!fullPhone) {
    return
  }

  const greeting = name ? `Hi ${name}, ` : ""
  let body = ""
  if (verificationLink && otp) {
    body = `${greeting}Welcome to Meeem! Verify your email with OTP: ${otp} or click: ${verificationLink}`
  } else if (verificationLink) {
    body = `${greeting}Welcome to Meeem! Please verify your email by clicking: ${verificationLink}`
  } else if (otp) {
    body = `${greeting}Your Meeem email verification code is: ${otp}`
  } else {
    return
  }

  try {
    await sendSmsViaTwilio({ to: fullPhone, body })
  } catch (error) {
    console.warn(`[SMS] Failed to send email verification SMS to ${fullPhone}:`, error)
  }
}

export async function sendPasswordResetSms({
  to,
  countryCode,
  otp,
  name,
  resetLink,
}: {
  to?: string | null
  countryCode?: string | null
  otp: string
  name?: string | null
  resetLink?: string
}): Promise<void> {
  const fullPhone = formatFullPhoneNumber(to, countryCode)
  if (!fullPhone) {
    return
  }

  const greeting = name ? `Hi ${name}, ` : ""
  let body = `${greeting}Your Meeem password reset OTP is: ${otp}. It expires in 10 minutes.`
  if (resetLink) {
    body += ` Reset link: ${resetLink}`
  }

  try {
    await sendSmsViaTwilio({ to: fullPhone, body })
  } catch (error) {
    console.warn(`[SMS] Failed to send password reset SMS to ${fullPhone}:`, error)
  }
}
