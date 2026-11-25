import crypto from "crypto"

const QR_TOKEN_PREFIX = "M1"
const PDF_TOKEN_PREFIX = "P1"

function getInvoiceQrSecret(): string {
  return (
    process.env.INVOICE_QR_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.MOBILE_JWT_SECRET_KEY ||
    process.env.JWT_SECRET_KEY ||
    "meeem-invoice-qr-fallback-secret"
  )
}

function signPayload(secret: string, encodedPayload: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url")
    .slice(0, 32)
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export interface InvoiceQrTokenData {
  o: string // orderId
  n: string // orderNumber
  s: string // sellerId or "ALL"
  v: number // version
}

/**
 * Creates a compact, tamper-proof HMAC-SHA256 signed token for invoice QR codes.
 */
export function createInvoiceQrToken(params: {
  orderId: string
  orderNumber: string
  sellerId?: string | null
}): string {
  const payload: InvoiceQrTokenData = {
    o: params.orderId,
    n: params.orderNumber,
    s: params.sellerId || "ALL",
    v: 1,
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sig = signPayload(getInvoiceQrSecret(), encoded)
  return `${QR_TOKEN_PREFIX}.${encoded}.${sig}`
}

export type VerifyInvoiceQrTokenResult =
  | {
      valid: true
      orderId: string
      orderNumber: string
      sellerId: string | null
    }
  | { valid: false; error: string }

/**
 * Verifies a signed M1.* invoice QR token using constant-time HMAC comparison.
 */
export function verifyInvoiceQrToken(token: string): VerifyInvoiceQrTokenResult {
  const clean = token.trim()
  const parts = clean.split(".")
  if (parts.length !== 3 || parts[0] !== QR_TOKEN_PREFIX) {
    return { valid: false, error: "Invalid QR token format" }
  }

  const [, encoded, sig] = parts
  const expectedSig = signPayload(getInvoiceQrSecret(), encoded)
  if (!safeEqual(sig, expectedSig)) {
    return { valid: false, error: "Invalid QR token signature" }
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<InvoiceQrTokenData>
    if (!parsed.o || typeof parsed.o !== "string" || !parsed.n || typeof parsed.n !== "string") {
      return { valid: false, error: "Corrupted QR token payload" }
    }
    return {
      valid: true,
      orderId: parsed.o,
      orderNumber: parsed.n,
      sellerId: parsed.s && parsed.s !== "ALL" ? parsed.s : null,
    }
  } catch {
    return { valid: false, error: "Malformed QR token payload" }
  }
}

interface InvoicePdfTokenPayload {
  o: string // orderId
  u: string // userId
  r: string // role
  s?: string | null // optional sellerId filter
  exp: number // unix epoch ms
}

/**
 * Creates a short-lived signed download token (15 minutes) so mobile apps can open PDF links
 * in external browsers / WebViews when Bearer headers cannot be attached.
 */
export function createInvoicePdfDownloadToken(params: {
  orderId: string
  userId: string
  role: string
  sellerId?: string | null
  ttlMinutes?: number
}): string {
  const ttl = (params.ttlMinutes ?? 15) * 60 * 1000
  const payload: InvoicePdfTokenPayload = {
    o: params.orderId,
    u: params.userId,
    r: params.role,
    s: params.sellerId || null,
    exp: Date.now() + ttl,
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sig = signPayload(getInvoiceQrSecret(), encoded)
  return `${PDF_TOKEN_PREFIX}.${encoded}.${sig}`
}

export function verifyInvoicePdfDownloadToken(token: string):
  | { valid: true; orderId: string; userId: string; role: string; sellerId: string | null }
  | { valid: false; error: string } {
  const clean = token.trim()
  const parts = clean.split(".")
  if (parts.length !== 3 || parts[0] !== PDF_TOKEN_PREFIX) {
    return { valid: false, error: "Invalid PDF download token" }
  }

  const [, encoded, sig] = parts
  const expectedSig = signPayload(getInvoiceQrSecret(), encoded)
  if (!safeEqual(sig, expectedSig)) {
    return { valid: false, error: "Invalid PDF download signature" }
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<InvoicePdfTokenPayload>
    if (!parsed.o || !parsed.u || !parsed.r || typeof parsed.exp !== "number") {
      return { valid: false, error: "Corrupted PDF token payload" }
    }
    if (Date.now() > parsed.exp) {
      return { valid: false, error: "PDF download token expired" }
    }
    return {
      valid: true,
      orderId: parsed.o,
      userId: parsed.u,
      role: parsed.r,
      sellerId: parsed.s ?? null,
    }
  } catch {
    return { valid: false, error: "Malformed PDF token payload" }
  }
}

export type ParsedQrInput =
  | { kind: "SIGNED_TOKEN"; token: string }
  | { kind: "ORDER_NUMBER"; orderNumber: string }
  | { kind: "ORDER_ID"; orderId: string }
  | { kind: "INVALID"; error: string }

/**
 * Parses any scanned QR code payload:
 * 1) Full verification URL (`https://.../invoice/verify?t=M1....`)
 * 2) Raw signed token (`M1....`)
 * 3) JSON payload (`{"token":...}` or `{"orderNumber":...}` or `{"orderId":...}`)
 * 4) Legacy QR string (`Order: #meeem00000001 | Store: ...`)
 * 5) Invoice reference or Order number (`INV-REF-meeem00000001-XPRO`, `INV-meeem00000001`, `#meeem00000001`, `meeem00000001`)
 */
export function parseInvoiceQrInput(rawInput: string): ParsedQrInput {
  const trimmed = rawInput.trim()
  if (!trimmed) {
    return { kind: "INVALID", error: "QR input is empty" }
  }

  // 1. Raw signed token
  if (trimmed.startsWith(`${QR_TOKEN_PREFIX}.`)) {
    return { kind: "SIGNED_TOKEN", token: trimmed }
  }

  // 2. URL containing ?t= or ?token=
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/invoice/verify")) {
    try {
      const urlObj = trimmed.startsWith("http")
        ? new URL(trimmed)
        : new URL(trimmed, "https://meeemsl.com")
      const tok = urlObj.searchParams.get("t") || urlObj.searchParams.get("token")
      if (tok && tok.startsWith(`${QR_TOKEN_PREFIX}.`)) {
        return { kind: "SIGNED_TOKEN", token: tok.trim() }
      }
      const orderNum = urlObj.searchParams.get("orderNumber") || urlObj.searchParams.get("order")
      if (orderNum) {
        return { kind: "ORDER_NUMBER", orderNumber: orderNum.replace(/^#/, "").trim() }
      }
      const oid = urlObj.searchParams.get("orderId")
      if (oid) {
        return { kind: "ORDER_ID", orderId: oid.trim() }
      }
    } catch {
      // fall through
    }
  }

  // 3. JSON payload
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>
      const tok = obj.token ?? obj.qrToken ?? obj.t
      if (typeof tok === "string" && tok.trim().startsWith(`${QR_TOKEN_PREFIX}.`)) {
        return { kind: "SIGNED_TOKEN", token: tok.trim() }
      }
      if (typeof obj.orderId === "string" && obj.orderId.trim()) {
        return { kind: "ORDER_ID", orderId: obj.orderId.trim() }
      }
      if (typeof obj.orderNumber === "string" && obj.orderNumber.trim()) {
        return { kind: "ORDER_NUMBER", orderNumber: obj.orderNumber.replace(/^#/, "").trim() }
      }
    } catch {
      // fall through
    }
  }

  // 4. Legacy pipe-delimited string: "Order: #meeem00000001 | Store: ..."
  const legacyMatch = trimmed.match(/Order:\s*#?([A-Za-z0-9_-]+)/i)
  if (legacyMatch?.[1]) {
    return { kind: "ORDER_NUMBER", orderNumber: legacyMatch[1].trim() }
  }

  // 5. Invoice ref formats: INV-REF-meeem00000001-XPRO, INV-meeem00000001-1, INV-ORD-123
  const invRefMatch = trimmed.match(/^INV-REF-([A-Za-z0-9_-]+)-XPRO$/i)
  if (invRefMatch?.[1]) {
    return { kind: "ORDER_NUMBER", orderNumber: invRefMatch[1].trim() }
  }
  const invMeeemMatch = trimmed.match(/^INV-(meeem[A-Za-z0-9]+)(?:-\d+)?$/i)
  if (invMeeemMatch?.[1]) {
    return { kind: "ORDER_NUMBER", orderNumber: invMeeemMatch[1].trim() }
  }
  const invNumMatch = trimmed.match(/^INV-([A-Za-z0-9_-]+)$/i)
  if (invNumMatch?.[1]) {
    return { kind: "ORDER_NUMBER", orderNumber: invNumMatch[1].trim() }
  }

  // 6. Plain orderNumber (e.g. #meeem00000001, meeem00000001, ORD-123) or CUID orderId
  const cleanPlain = trimmed.replace(/^#/, "").trim()
  if (/^c[a-z0-9]{20,}$/i.test(cleanPlain)) {
    return { kind: "ORDER_ID", orderId: cleanPlain }
  }
  if (/^[A-Za-z0-9_-]{4,64}$/.test(cleanPlain)) {
    return { kind: "ORDER_NUMBER", orderNumber: cleanPlain }
  }

  return { kind: "INVALID", error: "Unrecognized invoice QR code or reference" }
}

/**
 * Resolves the canonical public base URL for building QR verification links.
 */
export function resolveAppBaseUrl(requestUrlOrOrigin?: string | null): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim()

  if (requestUrlOrOrigin) {
    try {
      const parsed = new URL(requestUrlOrOrigin)
      if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
        return parsed.origin
      }
      if (!envUrl) {
        return parsed.origin
      }
    } catch {
      // ignore invalid URL
    }
  }

  if (envUrl) {
    return envUrl.replace(/\/+$/, "")
  }

  return "https://meeemsl.com"
}
