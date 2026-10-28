/**
 * AfriMoney Payment Gateway Helper, Diagnostics & Push USSD Client
 */

export interface AfriMoneyConfig {
  bridgeUrl: string
  bridgeKey: string
  consumerKey?: string
  consumerSecret?: string
  tokenUrl: string
  merchantMsisdn?: string
  apiKey?: string
  merchantPin?: string
  currency?: string
  provider?: string
  payId?: string
}

export function getAfriMoneyConfig(): AfriMoneyConfig {
  const bridgeUrl = (
    process.env.AFRIMONEY_BRIDGE_URL || "https://afrimoney.meeemsl.com/afrimoney"
  ).replace(/\/$/, "")

  const bridgeKey = process.env.AFRIMONEY_BRIDGE_KEY || ""
  // Fallback to Mario's provided UAT credentials if not yet set in environment
  const consumerKey = (
    process.env.AFRIMONEY_CONSUMER_KEY || "1l1WT3ngbDEW810swY5c6iE9WREa"
  ).trim()
  const consumerSecret = (
    process.env.AFRIMONEY_CONSUMER_SECRET || "kp42d7RWWSIvYWzduXpvoHqTKfAa"
  ).trim()
  const tokenUrl = (
    process.env.AFRIMONEY_TOKEN_URL || `${bridgeUrl}/token`
  ).trim()

  const merchantMsisdn = (
    process.env.AFRIMONEY_MERCHANT_MSISDN || "123000306"
  ).trim()
  const apiKey = (
    process.env.AFRIMONEY_API_KEY || "F812UuvHN0SD5kfCu31QGJK326Ynxm_cpIB2r0VnFbY"
  ).trim()
  const merchantPin = (process.env.AFRIMONEY_MERCHANT_PIN || "1234").trim()
  const currency = (process.env.AFRIMONEY_CURRENCY || "101").trim()
  const provider = (process.env.AFRIMONEY_PROVIDER || "101").trim()
  const payId = (process.env.AFRIMONEY_PAYID || "12").trim()

  return {
    bridgeUrl,
    bridgeKey,
    consumerKey,
    consumerSecret,
    tokenUrl,
    merchantMsisdn,
    apiKey,
    merchantPin,
    currency,
    provider,
    payId,
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
      signal: AbortSignal.timeout(30000), // 30s timeout requested by DevOps
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
      signal: AbortSignal.timeout(30000), // 30s timeout recommended by DevOps
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
      message: `AfriMoney token endpoint returned HTTP ${res.status}: ${body}`,
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

/**
 * In-memory OAuth token cache for AfriMoney WSO2 bearer tokens
 */
interface CachedToken {
  accessToken: string
  expiresAt: number
}

let tokenCache: CachedToken | null = null

/**
 * Retrieves a valid OAuth Bearer access token, renewing if expired
 */
export async function getAfriMoneyAccessToken(
  config: AfriMoneyConfig = getAfriMoneyConfig()
): Promise<string> {
  if (!config.consumerKey || !config.consumerSecret) {
    throw new Error(
      "AfriMoney Consumer Key and Secret are not configured in environment variables."
    )
  }

  // Return cached token if still valid (with 60s safety buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.accessToken
  }

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
    signal: AbortSignal.timeout(30000), // 30s timeout as requested by DevOps
    cache: "no-store",
  })

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "")
    throw new Error(
      `Failed to obtain AfriMoney OAuth token (HTTP ${res.status}): ${errorBody}`
    )
  }

  const data = await res.json()
  const accessToken = data.access_token
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600

  if (!accessToken) {
    throw new Error("No access_token returned by AfriMoney token endpoint.")
  }

  tokenCache = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  }

  return accessToken
}

/**
 * Generic gateway call sending both X-Bridge-Key and Authorization: Bearer <token>
 * Enforces a strict 30s timeout with clear network failure reporting.
 */
export async function callAfriMoneyGateway<T = any>({
  path,
  method = "POST",
  payload,
  headers = {},
  config = getAfriMoneyConfig(),
}: {
  path: string
  method?: string
  payload?: any
  headers?: Record<string, string>
  config?: AfriMoneyConfig
}): Promise<{ status: number; data: T }> {
  const token = await getAfriMoneyAccessToken(config)
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const targetUrl = `${config.bridgeUrl}${normalizedPath}`

  try {
    const res = await fetch(targetUrl, {
      method,
      headers: {
        "X-Bridge-Key": config.bridgeKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(30000), // 30s timeout as requested by DevOps
      cache: "no-store",
    })

    const text = await res.text()
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return {
      status: res.status,
      data,
    }
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.message?.includes("timeout")) {
      throw new Error(
        `AfriMoney Gateway request timed out after 30s on ${normalizedPath}. Check network tunnel status.`
      )
    }
    throw new Error(
      `AfriMoney Gateway request failed: ${err?.message || String(err)}`
    )
  }
}

/**
 * Parameters to initiate a Push USSD payment request
 */
export interface PushUssdInitiateParams {
  amount: number
  payerMsisdn: string
  externalReferenceId: string
  remarks?: string
}

export interface PushUssdInitiateResult {
  success: boolean
  status: number
  message: string
  txnId?: string
  data?: any
  raw?: any
}

/**
 * Step 4: Initiate a Merchant Payment via Push USSD
 * Sends:
 * - X-Bridge-Key: <bridge_key>
 * - Authorization: Bearer <oauth_token>
 * - X-API-KEY: Base64(<msisdn>:<key>)
 */
export async function initiateAfriMoneyPushUssd(
  params: PushUssdInitiateParams,
  config: AfriMoneyConfig = getAfriMoneyConfig()
): Promise<PushUssdInitiateResult> {
  const token = await getAfriMoneyAccessToken(config)

  if (!config.merchantMsisdn || !config.apiKey) {
    throw new Error(
      "AFRIMONEY_MERCHANT_MSISDN and AFRIMONEY_API_KEY must be configured."
    )
  }

  // Base64(<msisdn>:<key>) as specified in AfriMoney Push USSD API documentation
  const xApiKey = Buffer.from(
    `${config.merchantMsisdn.trim()}:${config.apiKey.trim()}`
  ).toString("base64")

  // Format phone number (e.g. 033600171 or 077928995)
  let cleanMsisdn = params.payerMsisdn.replace(/[^0-9]/g, "")
  if (cleanMsisdn.startsWith("232")) {
    cleanMsisdn = "0" + cleanMsisdn.slice(3)
  } else if (!cleanMsisdn.startsWith("0") && cleanMsisdn.length === 8) {
    cleanMsisdn = "0" + cleanMsisdn
  }

  const targetEndpoint = `${config.bridgeUrl}/push-ussd/merchant-payment/v1.0`

  const payload = {
    request_amount: params.amount,
    remarks: params.remarks || "MEEEM Payment",
    external_reference_id: params.externalReferenceId,
    payer_msisdn: cleanMsisdn,
  }

  try {
    const res = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        "X-Bridge-Key": config.bridgeKey,
        Authorization: `Bearer ${token}`,
        "X-API-KEY": xApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30s timeout recommended by DevOps
      cache: "no-store",
    })

    const text = await res.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {}

    const isSuccess =
      res.ok &&
      (json?.status === 200 ||
        json?.status === "200" ||
        json?.message?.toLowerCase().includes("initiated") ||
        Boolean(json?.data?.txnID))

    return {
      success: isSuccess,
      status: res.status,
      message:
        json?.message ||
        (res.ok
          ? "Transaction Initiated"
          : `AfriMoney error (HTTP ${res.status}): ${text}`),
      txnId: json?.data?.txnID?.trim(),
      data: json?.data,
      raw: json || text,
    }
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.message?.includes("timeout")) {
      throw new Error(
        "AfriMoney Push USSD request timed out after 30s. Check network tunnel status."
      )
    }
    throw new Error(
      `AfriMoney Push USSD request failed: ${err?.message || String(err)}`
    )
  }
}

/**
 * Step 5: Query transaction status using external reference ID (FTXNENQ)
 */
export async function queryAfriMoneyTransaction(
  externalReferenceId: string,
  config: AfriMoneyConfig = getAfriMoneyConfig()
): Promise<any> {
  const token = await getAfriMoneyAccessToken(config)
  const endpoint = `${config.bridgeUrl}/UserInfoJ/1.0`

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-Bridge-Key": config.bridgeKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      COMMAND: {
        TYPE: "FTXNENQ",
        FTXNID: externalReferenceId,
      },
    }),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  })

  return res.json()
}
