import { NextResponse } from "next/server"

/**
 * Normalizes phone numbers to standard E.164 format (+[country_code][number]).
 * Handles numbers with or without '+' and with optional default country code.
 */
function formatToE164(phone: string, defaultCountryCode: string = "+232"): string {
  const cleaned = phone.replace(/[\s\-().,/_]/g, "").trim()
  if (!cleaned) return ""

  // If already starts with '+'
  if (cleaned.startsWith("+")) {
    const digits = cleaned.replace(/\D/g, "")
    return digits ? `+${digits}` : ""
  }

  const digits = cleaned.replace(/\D/g, "")
  if (!digits) return ""

  // Common country codes that users type without '+'
  const commonCodes = ["232", "91", "1", "44", "234", "233", "254", "256", "250", "971", "966"]
  for (const cc of commonCodes) {
    if (digits.startsWith(cc) && digits.length >= cc.length + 6) {
      return `+${digits}`
    }
  }

  // If number starts with 0 (national trunk prefix), strip 0 and prepend default country code
  const ccDigits = defaultCountryCode.replace(/\D/g, "") || "232"
  if (digits.startsWith("0")) {
    return `+${ccDigits}${digits.replace(/^0+/, "")}`
  }

  // If short local number (7 to 9 digits)
  if (digits.length <= 9) {
    return `+${ccDigits}${digits}`
  }

  return `+${digits}`
}

/**
 * Validates E.164 phone format: '+' followed by 7 to 15 digits.
 */
function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone)
}

/**
 * GET /api/send-sms
 * Returns API usage documentation.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ready",
      endpoint: "POST /api/send-sms",
      description: "Send an SMS message to a phone number using POST method.",
      expectedPayload: {
        number: "+919876543210",
        msg: "Your text message here",
      },
      optionalFields: {
        countryCode: "+91 (optional fallback if number has no country code)",
      },
      curlExample: `curl -X POST http://localhost:3000/api/send-sms \\
  -H "Content-Type: application/json" \\
  -d '{"number": "+919876543210", "msg": "Hello, this is a test message!"}'`,
    },
    { status: 200 }
  )
}

/**
 * POST /api/send-sms
 * 
 * Standalone API endpoint to send SMS.
 * Requires:
 *  - number: string (target recipient phone number)
 *  - msg: string (message content)
 */
export async function POST(request: Request) {
  try {
    // 1. Read Twilio credentials directly from environment variables
    const accountSid =
      process.env.ACC_SID_TWILIO?.trim() ||
      process.env.TWILIO_ACCOUNT_SID?.trim() ||
      ""
    const authToken =
      process.env.AUTH_TOKEN_TWILIO?.trim() ||
      process.env.TWILIO_AUTH_TOKEN?.trim() ||
      ""
    const messagingServiceSid =
      process.env.MSG_SERVICESID?.trim() ||
      process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() ||
      ""
    const twilioPhoneNumber =
      process.env.TWILIO_PHONE_NUMBER?.trim() ||
      process.env.TWILIO_FROM?.trim() ||
      ""

    if (!accountSid || !authToken) {
      return NextResponse.json(
        {
          success: false,
          error: "SMS service is not configured. Missing Twilio Account SID or Auth Token in environment.",
        },
        { status: 500 }
      )
    }

    if (!messagingServiceSid && !twilioPhoneNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "SMS service is not configured. Missing Messaging Service SID or Twilio Phone Number in environment.",
        },
        { status: 500 }
      )
    }

    // 2. Parse request body (JSON or Form URL-encoded)
    let body: Record<string, any> = {}
    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      body = await request.json().catch(() => ({}))
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      try {
        const formData = await request.formData()
        formData.forEach((value, key) => {
          body[key] = value
        })
      } catch {
        body = await request.json().catch(() => ({}))
      }
    } else {
      try {
        body = await request.json()
      } catch {
        body = {}
      }
    }

    // 3. Extract parameters
    const rawNumber = body.number ?? body.phone ?? body.to ?? body.phoneNumber
    const rawMsg = body.msg ?? body.message ?? body.text ?? body.body
    const rawCountryCode = body.countryCode ?? body.country_code ?? "+232"

    // 4. Validate input
    if (
      rawNumber === undefined ||
      rawNumber === null ||
      String(rawNumber).trim() === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: 'number'. Please provide recipient phone number.",
          example: {
            number: "+919876543210",
            msg: "Your text message",
          },
        },
        { status: 400 }
      )
    }

    if (
      rawMsg === undefined ||
      rawMsg === null ||
      String(rawMsg).trim() === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: 'msg'. Please provide message text.",
          example: {
            number: "+919876543210",
            msg: "Your text message",
          },
        },
        { status: 400 }
      )
    }

    const numberStr = String(rawNumber).trim()
    const msgStr = String(rawMsg).trim()
    const countryCodeStr = String(rawCountryCode).trim()

    // 5. Normalize & validate phone number format
    const formattedNumber = formatToE164(numberStr, countryCodeStr)

    if (!isValidE164(formattedNumber)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid phone number format: '${numberStr}'. Please provide a valid phone number with country code (e.g. +919876543210, +23288994462, or +14155552671).`,
          received: numberStr,
        },
        { status: 400 }
      )
    }

    // 6. Send SMS via Twilio REST API directly
    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")

    const postParams = new URLSearchParams()
    postParams.set("To", formattedNumber)
    postParams.set("Body", msgStr)

    if (messagingServiceSid) {
      postParams.set("MessagingServiceSid", messagingServiceSid)
    } else {
      postParams.set("From", twilioPhoneNumber)
    }

    const twilioResponse = await fetch(twilioEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: postParams.toString(),
    })

    const twilioData = await twilioResponse.json().catch(() => null)

    if (!twilioResponse.ok) {
      const errorMessage =
        twilioData?.message ||
        `Twilio API error (status ${twilioResponse.status})`

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: twilioData?.code,
          moreInfo: twilioData?.more_info,
        },
        { status: twilioResponse.status >= 400 && twilioResponse.status < 500 ? 400 : 502 }
      )
    }

    // 7. Successful delivery response
    return NextResponse.json(
      {
        success: true,
        message: "SMS sent successfully.",
        data: {
          to: formattedNumber,
          msg: msgStr,
          sid: twilioData?.sid,
          status: twilioData?.status || "queued",
          dateCreated: twilioData?.date_created,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("[Standalone Send SMS API Error]:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error occurred while sending SMS.",
      },
      { status: 500 }
    )
  }
}
