import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getMessaging } from "firebase-admin/messaging"

export function getCleanPrivateKey(): string | undefined {
  let key = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY_BASE64
  if (!key) return undefined

  key = key.trim()

  // Strip surrounding double quotes or single quotes
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim()
  }

  // Check if string is base64 encoded (does not contain header directly)
  if (!key.includes("BEGIN PRIVATE KEY")) {
    try {
      const decoded = Buffer.from(key, "base64").toString("utf8")
      if (decoded.includes("BEGIN PRIVATE KEY")) {
        key = decoded.trim()
      }
    } catch {
      // Not valid base64, continue with original
    }
  }

  // Replace literal escaped \n with real newline characters
  key = key.replace(/\\n/g, "\n")

  return key
}

let appInitialized = false

function initFirebase() {
  if (appInitialized || getApps().length > 0) {
    appInitialized = true
    return
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = getCleanPrivateKey()

  if (projectId && clientEmail && privateKey) {
    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
      appInitialized = true
      console.log(`[Firebase Admin] Initialized successfully for project: ${projectId}`)
    } catch (error: any) {
      console.error("[Firebase Admin] Initialization failed:", error?.message || error)
    }
  } else {
    console.warn(
      `[Firebase Admin] Incomplete credentials in environment variables. ` +
      `projectId: ${!!projectId}, clientEmail: ${!!clientEmail}, privateKey: ${!!privateKey}`
    )
  }
}

// Attempt initialization on startup
initFirebase()

export function getFirebaseAuth() {
  if (!appInitialized && getApps().length === 0) {
    // Retry initialization lazily
    initFirebase()
  }

  if (getApps().length === 0) {
    return null
  }

  try {
    return getAuth()
  } catch (error) {
    console.error("[Firebase Admin] Failed to get Auth instance:", error)
    return null
  }
}

export function getFirebaseMessaging() {
  if (!appInitialized && getApps().length === 0) {
    initFirebase()
  }

  if (getApps().length === 0) {
    return null
  }

  try {
    return getMessaging()
  } catch (error) {
    console.error("[Firebase Admin] Failed to get Messaging instance:", error)
    return null
  }
}
