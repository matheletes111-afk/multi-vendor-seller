/**
 * Server-side verification of Google ID tokens and Facebook access tokens.
 * Used by mobile API social login routes (customer, service-seller, product-seller).
 */

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

export async function verifySocialToken(
  provider: "google" | "facebook",
  idToken: string | undefined,
  accessToken: string | undefined
): Promise<SocialProfile | null> {
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
