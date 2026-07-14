/**
 * Server-side verification of Google ID tokens and Facebook access tokens.
 * Used by mobile API social login routes (customer, service-seller, product-seller).
 */

import { getFirebaseAuth } from "./firebase-admin"

export type SocialProfile = {
  provider: "google" | "facebook"
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
  const clientId = process.env.AUTH_GOOGLE_ID
  if (!clientId) return null
  try {
    const res = await fetch(GOOGLE_TOKENINFO + encodeURIComponent(idToken), {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      aud?: string
      sub?: string
      email?: string
      email_verified?: string
      name?: string
      picture?: string
    }
    if (!data.sub || data.aud !== clientId) return null
    return {
      provider: "google",
      providerAccountId: data.sub,
      email: data.email ?? null,
      name: data.name ?? null,
      image: data.picture ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Verify Facebook access token by calling Graph API and return profile. Returns null if invalid.
 */
export async function verifyFacebookAccessToken(accessToken: string): Promise<SocialProfile | null> {
  const appId = process.env.AUTH_FACEBOOK_ID
  if (!appId) return null
  try {
    const res = await fetch(FB_GRAPH_ME + encodeURIComponent(accessToken), {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      id?: string
      email?: string
      name?: string
      picture?: { data?: { url?: string } }
    }
    if (!data.id) return null
    const imageUrl =
      typeof data.picture?.data?.url === "string" ? data.picture.data.url : null
    return {
      provider: "facebook",
      providerAccountId: data.id,
      email: data.email ?? null,
      name: data.name ?? null,
      image: imageUrl,
    }
  } catch {
    return null
  }
}

/**
 * Verify Firebase ID token and return profile. Returns null if invalid.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  expectedProvider: "google" | "facebook"
): Promise<SocialProfile | null> {
  try {
    const auth = getFirebaseAuth()
    if (!auth) {
      console.warn("Firebase Auth is not initialized. Skipping Firebase ID Token verification.")
      return null
    }
    const decodedToken = await auth.verifyIdToken(idToken)
    const email = decodedToken.email ?? null
    const name = decodedToken.name ?? null
    const image = decodedToken.picture ?? null

    // Determine the provider account ID.
    // Try to find the linked identity for google.com or facebook.com to match NextAuth's providerAccountId format.
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
    }

    return {
      provider: expectedProvider,
      providerAccountId,
      email,
      name,
      image,
    }
  } catch (error) {
    console.error("Firebase ID Token verification error:", error)
    return null
  }
}

export async function verifySocialToken(
  provider: "google" | "facebook",
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

  // Fallback to legacy/direct OAuth verification
  if (provider === "google") {
    if (!idToken || typeof idToken !== "string") return null
    return verifyGoogleIdToken(idToken)
  }
  if (provider === "facebook") {
    if (!accessToken || typeof accessToken !== "string") return null
    return verifyFacebookAccessToken(accessToken)
  }
  return null
}
