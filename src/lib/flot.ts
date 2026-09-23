import crypto from "crypto"
import fs from "fs"
import path from "path"

export interface FlotConfig {
  baseUrl: string
  merchantId: string
  privateKey: string
  webhookUsername?: string
  webhookPassword?: string
}

export interface CreateFlotPaymentLinkOptions {
  orderId: string
  amount: number | string
  currency?: string
  type?: "in-app" | "card" | "momo"
}

export interface FlotPaymentLinkResponse {
  id: string // internal order ID / attempt ID
  link: string | null
  code: string | null
}

export interface FlotPaymentAttemptResponse {
  id: string
  externalId: string
  amount: string
  currency: string
  status: "created" | "completed" | "failed"
  createdAt?: string
  updatedAt?: string
}

const DEFAULT_BASE_URL = "https://api.stage.flotme.ai"
const DEFAULT_MERCHANT_ID = "40bd76d6-de05-4ca3-9e32-47eed6e657b1"

/**
 * Retrieve Flot Private Key from environment or certs directory
 */
export function getFlotPrivateKey(): string {
  // 1. Direct environment variable (e.g. Vercel / Production)
  if (process.env.FLOT_PRIVATE_KEY) {
    let key = process.env.FLOT_PRIVATE_KEY
    if (key.includes("\\n")) {
      key = key.replace(/\\n/g, "\n")
    }
    return key.trim()
  }

  // 2. Custom path from env
  const customPath = process.env.FLOT_PRIVATE_KEY_PATH
  if (customPath) {
    const resolvedCustom = path.isAbsolute(customPath)
      ? customPath
      : path.join(process.cwd(), customPath)
    if (fs.existsSync(resolvedCustom)) {
      return fs.readFileSync(resolvedCustom, "utf8").trim()
    }
  }

  // 3. Default certs folder in project
  const defaultCertPath = path.join(process.cwd(), "certs", "flot_private_key.pem")
  if (fs.existsSync(defaultCertPath)) {
    return fs.readFileSync(defaultCertPath, "utf8").trim()
  }

  throw new Error(
    "Flot private key not found. Please set FLOT_PRIVATE_KEY in .env or provide certs/flot_private_key.pem"
  )
}

/**
 * Get configuration object for Flot
 */
export function getFlotConfig(): FlotConfig {
  return {
    baseUrl: (process.env.FLOT_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    merchantId: process.env.FLOT_MERCHANT_ID || DEFAULT_MERCHANT_ID,
    privateKey: getFlotPrivateKey(),
    webhookUsername: process.env.FLOT_WEBHOOK_USERNAME || "meeem_flot_webhook",
    webhookPassword: process.env.FLOT_WEBHOOK_PASSWORD || "meeem_flot_secret_2026",
  }
}

/**
 * Sign data string using RSA-4096, SHA-512, with RSA-PSS padding and Base64 output.
 */
export function signFlotPayload(dataString: string, privateKey?: string): string {
  const key = privateKey || getFlotPrivateKey()
  const signer = crypto.createSign("RSA-SHA512")
  signer.update(dataString)

  return signer.sign(
    {
      key,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    },
    "base64"
  )
}

/**
 * Create a Flot Payment Link for an ad order.
 */
export async function createFlotPaymentLink(
  options: CreateFlotPaymentLinkOptions
): Promise<FlotPaymentLinkResponse> {
  const config = getFlotConfig()
  const { orderId, currency = "SLE", type = "in-app" } = options

  // Flot requires amount to be a decimal string (e.g. "50.00" or "10")
  const amountStr =
    typeof options.amount === "number"
      ? options.amount.toFixed(2)
      : String(options.amount)

  const requestBody = {
    merchantId: config.merchantId,
    type,
    payload: {
      orderId,
      currency,
      amount: amountStr,
    },
  }

  // Exact JSON string to ensure signature match
  const rawBody = JSON.stringify(requestBody)
  const signature = signFlotPayload(rawBody, config.privateKey)

  const url = `${config.baseUrl}/merchants/private/v1/payment-links`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Flot-Merchant-Signature": signature,
      },
      body: rawBody,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.error("[Flot] Failed to create payment link:", {
        status: res.status,
        data,
        orderId,
      })
      throw new Error(
        data?.message || data?.error || `Flot API error (${res.status})`
      )
    }

    if (!data?.data?.id) {
      throw new Error("Flot response did not include payment link id")
    }

    return {
      id: data.data.id,
      link: data.data.link || null,
      code: data.data.code || null,
    }
  } catch (error: any) {
    console.error("[Flot] Network or signing error in createFlotPaymentLink:", error)
    throw error
  }
}

/**
 * Verify / check payment attempt status using Flot bodyless status API.
 */
export async function verifyFlotPaymentAttempt(params: {
  externalOrderId: string
  internalOrderId: string
}): Promise<FlotPaymentAttemptResponse | null> {
  const config = getFlotConfig()
  const { externalOrderId, internalOrderId } = params

  const canonicalPath = `/merchants/private/v1/external-orders/${externalOrderId}/payment-attempts/${internalOrderId}`
  const canonicalRequestString = `GET\n${canonicalPath}`

  const signature = signFlotPayload(canonicalRequestString, config.privateKey)
  const url = `${config.baseUrl}${canonicalPath}`

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Flot-Merchant-Id": config.merchantId,
        "X-Flot-Merchant-Signature": signature,
      },
      cache: "no-store",
    })

    if (!res.ok) {
      if (res.status === 404) return null
      const errText = await res.text().catch(() => "")
      console.warn(`[Flot] Status check failed (${res.status}):`, errText)
      return null
    }

    const json = await res.json().catch(() => ({}))
    if (!json?.data) return null

    return {
      id: json.data.id,
      externalId: json.data.externalId,
      amount: json.data.amount,
      currency: json.data.currency,
      status: json.data.status,
      createdAt: json.data.createdAt,
      updatedAt: json.data.updatedAt,
    }
  } catch (error) {
    console.error("[Flot] Error checking attempt status:", error)
    return null
  }
}

/**
 * Verify HTTP Basic Authentication for incoming Flot Webhooks.
 */
export function verifyFlotWebhookBasicAuth(authHeader: string | null): boolean {
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false
  }

  const config = getFlotConfig()
  const expectedUser = config.webhookUsername
  const expectedPass = config.webhookPassword

  if (!expectedUser || !expectedPass) {
    console.warn("[Flot] Webhook credentials not configured in environment.")
    return false
  }

  const base64Credentials = authHeader.substring(6).trim()
  try {
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf8")
    const [user, pass] = credentials.split(":")
    return user === expectedUser && pass === expectedPass
  } catch {
    return false
  }
}
