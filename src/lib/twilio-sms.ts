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

export function normalizePhoneNumber(input: string): string {
  const trimmed = input.trim()
  const hasPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/\D/g, "")
  if (!digits) return ""
  return hasPlus ? `+${digits}` : digits
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone)
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
