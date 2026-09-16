import * as fs from "fs"
import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  JWSTransactionDecodedPayload,
  ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library"
import { getAppleRootCertificates } from "./apple-certs"

function getApplePrivateKey(): string {
  // Method 1: Direct string from environment variable (ideal for Vercel/Cloud)
  if (process.env.APPLE_IAP_PRIVATE_KEY) {
    return process.env.APPLE_IAP_PRIVATE_KEY.replace(/\\n/g, "\n")
  }

  // Method 2: File path from environment variable (ideal for VPS/local)
  if (process.env.APPLE_IAP_PRIVATE_KEY_PATH) {
    try {
      if (fs.existsSync(process.env.APPLE_IAP_PRIVATE_KEY_PATH)) {
        return fs.readFileSync(process.env.APPLE_IAP_PRIVATE_KEY_PATH, "utf8")
      }
    } catch (err) {
      console.error("[AppleIAP] Failed to read private key from path:", err)
    }
  }

  return ""
}

function getEnvironment(): Environment {
  const env = (process.env.APPLE_ENVIRONMENT || "Sandbox").toLowerCase()
  return env === "production" ? Environment.PRODUCTION : Environment.SANDBOX
}

let cachedVerifier: {
  verifier: SignedDataVerifier
  environment: Environment
  bundleId: string
  appAppleId?: number
} | null = null

let cachedApiClient: {
  client: AppStoreServerAPIClient
  environment: Environment
  keyId: string
  issuerId: string
  bundleId: string
} | null = null

/**
 * Clear cached verifier and API client instances (useful for testing or config changes).
 */
export function clearAppleIapCache(): void {
  cachedVerifier = null
  cachedApiClient = null
}

export function getSignedDataVerifier(): SignedDataVerifier {
  const rootCertificates = getAppleRootCertificates()
  const environment = getEnvironment()
  const bundleId = process.env.APPLE_BUNDLE_ID || "com.meeem.seller"
  const appAppleId = process.env.APPLE_APP_ID
    ? parseInt(process.env.APPLE_APP_ID, 10)
    : undefined

  if (
    cachedVerifier &&
    cachedVerifier.environment === environment &&
    cachedVerifier.bundleId === bundleId &&
    cachedVerifier.appAppleId === appAppleId
  ) {
    return cachedVerifier.verifier
  }

  // enableOnlineChecks checks OCSP revocation status
  const enableOnlineChecks = process.env.NODE_ENV === "production"

  const verifier = new SignedDataVerifier(
    rootCertificates,
    enableOnlineChecks,
    environment,
    bundleId,
    appAppleId
  )

  cachedVerifier = { verifier, environment, bundleId, appAppleId }
  return verifier
}

export function getAppStoreServerAPIClient(): AppStoreServerAPIClient | null {
  const privateKey = getApplePrivateKey()
  const keyId = process.env.APPLE_IAP_KEY_ID
  const issuerId = process.env.APPLE_IAP_ISSUER_ID
  const bundleId = process.env.APPLE_BUNDLE_ID || "com.meeem.seller"
  const environment = getEnvironment()

  if (!privateKey || !keyId || !issuerId) {
    console.warn(
      "[AppleIAP] AppStoreServerAPIClient credentials not fully configured in env."
    )
    return null
  }

  if (
    cachedApiClient &&
    cachedApiClient.environment === environment &&
    cachedApiClient.keyId === keyId &&
    cachedApiClient.issuerId === issuerId &&
    cachedApiClient.bundleId === bundleId
  ) {
    return cachedApiClient.client
  }

  const client = new AppStoreServerAPIClient(
    privateKey,
    keyId,
    issuerId,
    bundleId,
    environment
  )

  cachedApiClient = { client, environment, keyId, issuerId, bundleId }
  return client
}

/**
 * Cryptographically verifies and decodes a StoreKit 2 JWS transaction representation.
 */
export async function verifyStoreKit2Transaction(
  jws: string
): Promise<JWSTransactionDecodedPayload> {
  const verifier = getSignedDataVerifier()
  const transaction = await verifier.verifyAndDecodeTransaction(jws)

  const expectedBundleId = process.env.APPLE_BUNDLE_ID || "com.meeem.seller"
  if (transaction.bundleId && transaction.bundleId !== expectedBundleId) {
    throw new Error(
      `Bundle ID mismatch: expected ${expectedBundleId}, got ${transaction.bundleId}`
    )
  }

  return transaction
}

/**
 * Cryptographically verifies and decodes an App Store Server Notifications v2 signed payload.
 */
export async function verifyAndDecodeNotification(
  signedPayload: string
): Promise<ResponseBodyV2DecodedPayload> {
  const verifier = getSignedDataVerifier()
  return await verifier.verifyAndDecodeNotification(signedPayload)
}
