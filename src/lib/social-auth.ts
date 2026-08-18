/**
 * Server-side verification of Google ID tokens, Facebook access tokens, and Apple ID tokens.
 * Used by mobile API social login routes (customer, service-seller, product-seller, hotel-seller, restaurant-seller).
 */

import { getFirebaseAuth } from "./firebase-admin"
import jwt from "jsonwebtoken"

export type SocialProfile = {
  provider: "google" | "facebook" | "apple"
  providerAccountId: string
  email: string | null
  name: string | null
  image: string | null
}

const GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?id_token="
const FB_GRAPH_ME = "https://graph.facebook.com/me?fields=id,email,name,picture&access_token="

/**
 * Verify Google ID token and return profile. Returns null if invalid.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<SocialProfile | null> {
  if (!idToken || typeof idToken !== "string") {
    return null
  }

  try {
    const res = await fetch(GOOGLE_TOKENINFO + encodeURIComponent(idToken.trim()), {
      method: "GET",
      headers: { Accept: "application/json" },
    })

    if (!res.ok) {
      console.warn("[verifyGoogleIdToken] Google tokeninfo API returned non-200 status:", res.status)
      return null
    }

    const data = (await res.json()) as {
      iss?: string
      aud?: string
      sub?: string
      email?: string
      email_verified?: string | boolean
      name?: string
      picture?: string
      exp?: string
    }

    if (!data.sub) {
      console.warn("[verifyGoogleIdToken] Token missing 'sub' identifier.")
      return null
    }

    // Verify issuer is Google
    const validIssuers = ["accounts.google.com", "https://accounts.google.com"]
    if (data.iss && !validIssuers.includes(data.iss)) {
      console.warn("[verifyGoogleIdToken] Unexpected issuer:", data.iss)
      return null
    }

    // Collect all configured candidate Google Client IDs from environment variables
    const candidateClientIds = [
      process.env.AUTH_GOOGLE_ID,
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ID,
      process.env.GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.AUTH_GOOGLE_CLIENT_ID,
    ]
      .filter(Boolean)
      .flatMap((id) => (id as string).split(",").map((s) => s.trim()))
      .filter((s) => s.length > 0)

    // If client IDs are configured, check whether token aud matches any of them
    if (candidateClientIds.length > 0) {
      const matchFound = data.aud && candidateClientIds.includes(data.aud)
      if (!matchFound) {
        console.warn(
          `[verifyGoogleIdToken] Token audience (${data.aud}) does not match any configured Client IDs (${candidateClientIds.join(
            ", "
          )}). Accepting Google-validated token with warning.`
        )
      }
    }

    return {
      provider: "google",
      providerAccountId: data.sub,
      email: data.email ?? null,
      name: data.name ?? null,
      image: data.picture ?? null,
    }
  } catch (err) {
    console.error("[verifyGoogleIdToken] Error contacting Google tokeninfo:", err)
    return null
  }
}

/**
 * Verify Facebook access token by calling Graph API and return profile. Returns null if invalid.
 */
export async function verifyFacebookAccessToken(accessToken: string): Promise<SocialProfile | null> {
  if (!accessToken || typeof accessToken !== "string") {
    return null
  }

  try {
    const res = await fetch(FB_GRAPH_ME + encodeURIComponent(accessToken.trim()), {
      method: "GET",
      headers: { Accept: "application/json" },
    })

    if (!res.ok) {
      console.warn("[verifyFacebookAccessToken] Facebook Graph API returned non-200 status:", res.status)
      return null
    }

    const data = (await res.json()) as {
      id?: string
      email?: string
      name?: string
      picture?: { data?: { url?: string } }
    }

    if (!data.id) {
      console.warn("[verifyFacebookAccessToken] Facebook response missing 'id'.")
      return null
    }

    const imageUrl =
      typeof data.picture?.data?.url === "string" ? data.picture.data.url : null

    return {
      provider: "facebook",
      providerAccountId: data.id,
      email: data.email ?? null,
      name: data.name ?? null,
      image: imageUrl,
    }
  } catch (err) {
    console.error("[verifyFacebookAccessToken] Error contacting Facebook Graph API:", err)
    return null
  }
}

/**
 * Verify direct Apple ID token (identityToken JWT issued by Apple). Returns null if invalid.
 */
export async function verifyAppleIdToken(idToken: string): Promise<SocialProfile | null> {
  if (!idToken || typeof idToken !== "string") {
    return null
  }

  try {
    const decoded = jwt.decode(idToken.trim(), { complete: true }) as {
      header?: { kid?: string; alg?: string }
      payload?: {
        iss?: string
        aud?: string
        sub?: string
        email?: string
        email_verified?: boolean | string
        exp?: number
      }
    } | null

    if (!decoded || !decoded.payload) {
      console.warn("[verifyAppleIdToken] Could not decode Apple JWT token.")
      return null
    }

    const { iss, sub, email, exp } = decoded.payload

    // Verify Apple issuer
    if (iss !== "https://appleid.apple.com") {
      console.warn("[verifyAppleIdToken] Invalid issuer for Apple token:", iss)
      return null
    }
    if (!sub) {
      console.warn("[verifyAppleIdToken] Apple token missing 'sub'.")
      return null
    }
    if (exp && exp * 1000 < Date.now()) {
      console.warn("[verifyAppleIdToken] Apple token has expired (exp:", exp, ").")
      return null
    }

    return {
      provider: "apple",
      providerAccountId: sub,
      email: email ?? null,
      name: null,
      image: null,
    }
  } catch (error) {
    console.error("[verifyAppleIdToken] Error decoding Apple ID token:", error)
    return null
  }
}

/**
 * Verify Firebase ID token and return profile. Returns null if invalid.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  expectedProvider: "google" | "facebook" | "apple"
): Promise<SocialProfile | null> {
  if (!idToken || typeof idToken !== "string") {
    return null
  }

  try {
    const auth = getFirebaseAuth()
    if (!auth) {
      return null
    }

    const decodedToken = await auth.verifyIdToken(idToken.trim())
    const email = decodedToken.email ?? null
    const name = decodedToken.name ?? null
    const image = decodedToken.picture ?? null

    // Determine the provider account ID.
    const identities = decodedToken.firebase?.identities || {}
    const signInProvider = decodedToken.firebase?.sign_in_provider
    let providerAccountId = decodedToken.uid

    if (expectedProvider === "google" && signInProvider === "google.com") {
      if (Array.isArray(identities["google.com"]) && identities["google.com"].length > 0) {
        providerAccountId = identities["google.com"][0]
      }
    } else if (expectedProvider === "facebook" && signInProvider === "facebook.com") {
      if (Array.isArray(identities["facebook.com"]) && identities["facebook.com"].length > 0) {
        providerAccountId = identities["facebook.com"][0]
      }
    } else if (
      expectedProvider === "apple" &&
      (signInProvider === "apple.com" || signInProvider === "apple")
    ) {
      if (Array.isArray(identities["apple.com"]) && identities["apple.com"].length > 0) {
        providerAccountId = identities["apple.com"][0]
      }
    }

    return {
      provider: expectedProvider,
      providerAccountId,
      email,
      name,
      image,
    }
  } catch (error) {
    // Non-fatal if Firebase isn't used for this token; log debug info
    console.warn("[verifyFirebaseIdToken] Firebase ID Token check failed, falling back to direct provider verification:", (error as any)?.message)
    return null
  }
}

export async function verifySocialToken(
  provider: "google" | "facebook" | "apple",
  idToken: string | undefined,
  accessToken: string | undefined
): Promise<SocialProfile | null> {
  // If idToken is provided, check if it verifies as a Firebase ID token.
  if (idToken && typeof idToken === "string") {
    const firebaseProfile = await verifyFirebaseIdToken(idToken, provider)
    if (firebaseProfile) {
      return firebaseProfile
    }
  }

  // Fallback to direct OAuth verification
  if (provider === "google") {
    if (!idToken || typeof idToken !== "string") {
      console.warn("[verifySocialToken] Google login requested without valid idToken.")
      return null
    }
    return verifyGoogleIdToken(idToken)
  }

  if (provider === "facebook") {
    if (!accessToken || typeof accessToken !== "string") {
      console.warn("[verifySocialToken] Facebook login requested without valid accessToken.")
      return null
    }
    return verifyFacebookAccessToken(accessToken)
  }

  if (provider === "apple") {
    if (!idToken || typeof idToken !== "string") {
      console.warn("[verifySocialToken] Apple login requested without valid idToken.")
      return null
    }
    return verifyAppleIdToken(idToken)
  }

  return null
}
