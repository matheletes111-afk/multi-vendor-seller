import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/rbac"
import { getFlotConfig, createFlotPaymentLink, signFlotPayload } from "@/lib/flot"

export const dynamic = "force-dynamic"

/**
 * Diagnostic & Connection Test API for Float Payment Gateway
 * Accessible via:
 * 1. Admin login session
 * 2. OR Secret token query param: ?secret=<FLOT_WEBHOOK_PASSWORD>
 *
 * URL: GET https://www.meeemsl.com/api/flot/test?secret=meeem_flot_secret_2026
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secretParam = searchParams.get("secret")

  // Authentication check
  const session = await auth().catch(() => null)
  const isAuthorizedAdmin = session?.user ? isAdmin(session.user) : false

  let config: any = null
  let privateKeyFound = false
  let privateKeyLength = 0
  let privateKeyError: string | null = null

  try {
    config = getFlotConfig()
    privateKeyFound = Boolean(config.privateKey)
    privateKeyLength = config.privateKey?.length || 0
  } catch (err: any) {
    privateKeyError = err?.message || "Failed to load private key"
  }

  const expectedSecret = config?.webhookPassword || process.env.FLOT_WEBHOOK_PASSWORD || "meeem_flot_secret_2026"
  const isAuthorizedBySecret = secretParam && secretParam === expectedSecret

  if (!isAuthorizedAdmin && !isAuthorizedBySecret) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint: "Provide ?secret=<FLOT_WEBHOOK_PASSWORD> in URL or log in as Admin to run Float connection diagnostics.",
      },
      { status: 401 }
    )
  }

  if (!privateKeyFound || !config) {
    return NextResponse.json(
      {
        success: false,
        error: "Private Key Missing",
        details: privateKeyError || "No FLOT_PRIVATE_KEY found in .env or certs folder",
        solution: "Set FLOT_PRIVATE_KEY in your server environment variables.",
      },
      { status: 500 }
    )
  }

  // Verify signing ability
  let signatureTestPass = false
  try {
    const testSig = signFlotPayload("TEST_STRING", config.privateKey)
    signatureTestPass = Boolean(testSig && testSig.length > 50)
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error: "RSA-PSS Signing Failed",
        details: e?.message,
        keyLength: config.privateKey?.length,
        hasBegin: config.privateKey?.includes("BEGIN"),
        hasEnd: config.privateKey?.includes("END"),
        hint: "Please set FLOT_PRIVATE_KEY_BASE64 in AWS Amplify Console with the one-line Base64 string.",
      },
      { status: 500 }
    )
  }

  // Send live diagnostic request to Float Staging
  const testOrderId = `DIAG_${Date.now()}`
  const testAmount = parseFloat(searchParams.get("amount") || "10")

  try {
    const flotRes = await createFlotPaymentLink({
      orderId: testOrderId,
      amount: testAmount,
      currency: "SLE",
      type: "in-app",
    })

    return NextResponse.json({
      success: true,
      message: "Float Payment Gateway is CONNECTED and ready to accept payments!",
      diagnostic: {
        baseUrl: config.baseUrl,
        merchantId: config.merchantId,
        privateKeyLength,
        signatureEngine: "RSA-4096 / SHA-512 / PSS",
        testOrderId,
      },
      floatResponse: {
        attemptId: flotRes.id,
        paymentUrl: flotRes.link,
        code: flotRes.code,
      },
    })
  } catch (error: any) {
    const errMsg = String(error?.message || error)
    let explanation = "Float API responded with an error."
    let solution = "Check Float dashboard credentials."

    if (errMsg.includes("403")) {
      explanation = "HTTP 403 Forbidden: Float rejected the request signature."
      solution =
        "The FLOT_PRIVATE_KEY on your server does not match the Public Key registered on Float's side for merchant ID: " +
        config.merchantId +
        ". Please paste the exact private key that Float team shared with you."
    } else if (errMsg.includes("400")) {
      explanation = "HTTP 400 Bad Request: Float rejected payload fields."
      solution = "Verify currency (must be SLE) and amount format."
    }

    return NextResponse.json(
      {
        success: false,
        error: errMsg,
        explanation,
        solution,
        diagnostic: {
          baseUrl: config.baseUrl,
          merchantId: config.merchantId,
          privateKeyLength,
          signatureTestPass,
          testOrderId,
        },
      },
      { status: 502 }
    )
  }
}
