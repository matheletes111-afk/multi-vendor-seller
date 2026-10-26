/**
 * AfriMoney Payment Gateway Helper & Diagnostics
 */

export interface AfriMoneyConfig {
  bridgeUrl: string
  bridgeKey: string
  consumerKey?: string
  consumerSecret?: string
  tokenUrl: string
}

export function getAfriMoneyConfig(): AfriMoneyConfig {
  const bridgeUrl = (
    process.env.AFRIMONEY_BRIDGE_URL || "https://afrimoney.meeemsl.com/afrimoney"
  ).replace(/\/$/, "")

  const bridgeKey = process.env.AFRIMONEY_BRIDGE_KEY || ""
  const consumerKey = process.env.AFRIMONEY_CONSUMER_KEY || ""
  const consumerSecret = process.env.AFRIMONEY_CONSUMER_SECRET || ""
  const tokenUrl = (
    process.env.AFRIMONEY_TOKEN_URL || `${bridgeUrl}/token`
  ).trim()

  return {
    bridgeUrl,
    bridgeKey,
    consumerKey,
    consumerSecret,
    tokenUrl,
  }
}

/**
 * Masks a sensitive key string for safe diagnostic display
 */
export function maskKey(key: string | undefined | null): string {
  if (!key) return "NOT_CONFIGURED"
  const trimmed = key.trim()
  if (trimmed.length <= 6) return "******"
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-3)}`
}

/**
 * Step 1: Health check on the public bridge endpoint
 */
export async function checkBridgeHealth(bridgeUrl: string): Promise<{
  ok: boolean
  status: number
  body: string
  error?: string
}> {
  try {
    const urlObj = new URL(bridgeUrl)
    const healthUrl = `${urlObj.origin}/health`

    const res = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    })

    const body = await res.text()
    return {
      ok: res.ok,
      status: res.status,
      body: body.trim(),
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      body: "",
      error: err?.message || String(err),
    }
  }
}

/**
 * Step 2: Test Bridge Tunnel to AfriMoney Gateway
 */
export async function testBridgeTunnel(
  bridgeUrl: string,
  bridgeKey: string
): Promise<{
  status: number
  headers: Record<string, string>
  body: string
  verdict:
    | "TUNNEL_CONNECTED_AND_GATEWAY_REACHED"
    | "INVALID_BRIDGE_KEY"
    | "VPN_TUNNEL_DOWN_OR_TIMEOUT"
    | "UNEXPECTED_RESPONSE"
  message: string
}> {
  if (!bridgeKey) {
    return {
      status: 401,
      headers: {},
      body: "AFRIMONEY_BRIDGE_KEY is empty in server environment.",
      verdict: "INVALID_BRIDGE_KEY",
      message: "Please set AFRIMONEY_BRIDGE_KEY in your .env or AWS Amplify Console.",
    }
  }

  const testEndpoint = `${bridgeUrl}/push-ussd/merchant-payment/v1.0`

  try {
    const res = await fetch(testEndpoint, {
      method: "POST",
      headers: {
        "X-Bridge-Key": bridgeKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    })

    const body = await res.text()
    const headersObj: Record<string, string> = {}
    res.headers.forEach((val, key) => {
      headersObj[key] = val
    })

    // 504 Gateway Timeout -> VPN Tunnel is down
    if (res.status === 504) {
      return {
        status: 504,
        headers: headersObj,
        body,
        verdict: "VPN_TUNNEL_DOWN_OR_TIMEOUT",
        message:
          "504 Gateway Timeout: The bridge reached Nginx, but Nginx could not connect to 10.28.99.163:8280. Verify strongSwan IPSec tunnel.",
      }
    }

    // 401 from Nginx vs 401 from WSO2
    const isNginxAuthFail =
      res.status === 401 &&
      (body.includes("401 Authorization Required") ||
        headersObj["server"]?.toLowerCase().includes("nginx")) &&
      !body.includes("WSO2") &&
      !body.includes("invalid_credentials") &&
      !body.includes("Unauthenticated")

    if (isNginxAuthFail && !body.includes("fault") && !body.includes("oauth")) {
      return {
        status: 401,
        headers: headersObj,
        body,
        verdict: "INVALID_BRIDGE_KEY",
        message:
          "401 Unauthorized: Nginx rejected the X-Bridge-Key. Check that AFRIMONEY_BRIDGE_KEY matches .bridge-key on the server.",
      }
    }

    // Any response from WSO2 (401 Missing Access Token, 403, 400 Bad Request, or 200 OK)
    // proves the request made it through the VPN tunnel to AfriMoney!
    return {
      status: res.status,
      headers: headersObj,
      body,
      verdict: "TUNNEL_CONNECTED_AND_GATEWAY_REACHED",
      message:
        "Success! The request successfully crossed the IPSec VPN tunnel and reached AfriMoney's WSO2 API Gateway.",
    }
  } catch (err: any) {
    return {
      status: 0,
      headers: {},
      body: err?.message || String(err),
      verdict: "VPN_TUNNEL_DOWN_OR_TIMEOUT",
      message: `Network error reaching bridge: ${err?.message || String(err)}`,
    }
  }
}

/**
 * Step 3: Test OAuth token generation if credentials exist
 */
export async function testOAuthToken(config: AfriMoneyConfig): Promise<{
  attempted: boolean
  success: boolean
  status: number
  body: string
  message: string
}> {
  if (!config.consumerKey || !config.consumerSecret) {
    return {
      attempted: false,
      success: false,
      status: 0,
      body: "",
      message:
        "Pending: Consumer Key & Consumer Secret not yet configured in environment variables.",
    }
  }

  try {
    const credentials = Buffer.from(
      `${config.consumerKey}:${config.consumerSecret}`
    ).toString("base64")

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "X-Bridge-Key": config.bridgeKey,
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    })

    const body = await res.text()

    if (res.ok) {
      return {
        attempted: true,
        success: true,
        status: res.status,
        body,
        message: "OAuth token successfully retrieved from AfriMoney WSO2!",
      }
    }

    return {
      attempted: true,
      success: false,
      status: res.status,
      body,
      message: `AfriMoney token endpoint returned HTTP ${res.status}.`,
    }
  } catch (err: any) {
    return {
      attempted: true,
      success: false,
      status: 0,
      body: err?.message || String(err),
      message: `Failed to connect to token endpoint: ${err?.message || String(err)}`,
    }
  }
}
