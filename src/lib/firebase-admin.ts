import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
let privateKey = process.env.FIREBASE_PRIVATE_KEY

if (privateKey) {
  // Strip surrounding quotes if present
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1)
  } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.slice(1, -1)
  }
  privateKey = privateKey.replace(/\\n/g, "\n")
}

let appInitialized = false

if (getApps().length === 0) {
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
    } catch (error) {
      console.error("Failed to initialize Firebase Admin SDK:", error)
    }
  } else {
    console.warn("Firebase Admin SDK credentials not fully configured in environment variables.")
  }
} else {
  appInitialized = true
}

export function getFirebaseAuth() {
  if (!appInitialized) {
    return null
  }
  try {
    return getAuth()
  } catch (error) {
    console.error("Failed to get Firebase Auth instance:", error)
    return null
  }
}

