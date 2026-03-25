type SendSmsInput = {
  to: string
  body: string
}

const TWILIO_ACCOUNT_SID = process.env.ACC_SID_TWILIO?.trim() ?? ""
const TWILIO_AUTH_TOKEN = process.env.AUTH_TOKEN_TWILIO?.trim() ?? ""
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER?.trim() ?? ""

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
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    throw new Error("Twilio environment variables are missing.")
  }

  const params = new URLSearchParams({
    To: to,
    From: TWILIO_PHONE_NUMBER,
    Body: body,
  })

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
