import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import Facebook from "next-auth/providers/facebook"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { verifyOtpLoginToken } from "@/lib/web-otp-login"
import { isSafeRedirectUrl } from "./safe-redirect"


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers: any[] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      role: { label: "Role", type: "text" },
      otpLoginToken: { label: "OTP Login Token", type: "text" },
    },
    async authorize(credentials) {
      if (!credentials?.email) {
        return null
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email as string },
      })

      if (!user) {
        return null
      }

      const otpLoginToken =
        typeof credentials.otpLoginToken === "string" ? credentials.otpLoginToken.trim() : ""
      const isOtpLogin = otpLoginToken.length > 0
      if (isOtpLogin) {
        const payload = verifyOtpLoginToken(otpLoginToken)
        if (!payload) return null
        if (payload.email !== user.email.toLowerCase().trim()) return null
        if (payload.role !== user.role) return null
      } else {
        if (!credentials?.password || !user.password) return null
        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }
      }

      const requestedRole = credentials.role as string | undefined
      if (requestedRole && user.role !== requestedRole) {
        return null
      }

      // Sellers: allow login even if pending admin approval, but block suspended.
      // We also surface isApproved / isSuspended on the session so middleware can restrict access.
      if (
        user.role === UserRole.SELLER_PRODUCT ||
        user.role === UserRole.SELLER_SERVICE ||
        user.role === UserRole.SELLER_HOTEL ||
        user.role === UserRole.SELLER_RESTAURANT
      ) {
        let seller: any = null
        if (user.role === UserRole.SELLER_HOTEL) {
          seller = await prisma.hotelSeller.findUnique({
            where: { userId: user.id },
            select: { isApproved: true, isSuspended: true, onboardingCompleted: true, onboardingStep: true } as any
          })
        } else if (user.role === UserRole.SELLER_RESTAURANT) {
          seller = await prisma.restaurantSeller.findUnique({
            where: { userId: user.id },
            select: { isApproved: true, isSuspended: true, onboardingCompleted: true, onboardingStep: true } as any
          })
        } else {
          seller = await prisma.seller.findUnique({
            where: { userId: user.id },
            select: { isApproved: true, isSuspended: true, onboardingCompleted: true, onboardingStep: true } as any
          })
        }

        if (!seller || (seller.isSuspended ?? false)) {
          return null
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
          passwordHash: user.password,
          isApproved: seller.isApproved,
          isSuspended: seller.isSuspended ?? false,
          onboardingCompleted: seller.onboardingCompleted,
          onboardingStep: seller.onboardingStep,
        }
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image,
        passwordHash: user.password,
      }
    },
  }),
]

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Always show the Google account chooser so the user can pick a different Gmail.
      // Without this, Google often auto-reuses the last authenticated account.
      authorization: {
        params: {
          // Force both account selection and a re-check/consent, which tends to make Google show the chooser reliably.
          prompt: "select_account consent",
          access_type: "offline",
          response_type: "code",
        },
      },
      // Important: don't link OAuth accounts to existing users just by email.
      // Email-based account linking can cause multiple external accounts to attach to the
      // same `users` row, which then makes role changes appear to affect the wrong user.
    })
  )
}
if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
  providers.push(
    Facebook({
      clientId: process.env.AUTH_FACEBOOK_ID,
      clientSecret: process.env.AUTH_FACEBOOK_SECRET,
      // See Google provider comment above.
    })
  )
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  basePath: "/api/nextauth",
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/customer/login",
    signOut: "/",
    error: "/customer/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Handle session updates from the client side (e.g. update({ onboardingCompleted: true }))
      if (trigger === "update" && session) {
        if (session.name !== undefined) token.name = session.name
        if (session.image !== undefined) token.image = session.image
        if (session.onboardingCompleted !== undefined) token.onboardingCompleted = session.onboardingCompleted
        if (session.isApproved !== undefined) token.isApproved = session.isApproved
        if (session.isSuspended !== undefined) token.isSuspended = session.isSuspended
        if (session.onboardingStep !== undefined) token.onboardingStep = session.onboardingStep
        return token
      }

      if (user) {
        token.id = user.id
        token.email = user.email
        token.role = (user as any).role
        token.passwordHash = (user as any).passwordHash

        let sellerInfo = user as any

        // For Social logins (PrismaAdapter), the 'user' object from the adapter 
        // doesn't include Seller-specific fields like onboardingCompleted.
        // We fetch them here if they are missing but the role is a SELLER.
        if (
          (token.role === UserRole.SELLER_PRODUCT ||
            token.role === UserRole.SELLER_SERVICE ||
            token.role === UserRole.SELLER_HOTEL ||
            token.role === UserRole.SELLER_RESTAURANT) &&
          sellerInfo.onboardingCompleted === undefined
        ) {
          let seller: any = null
          if (token.role === UserRole.SELLER_HOTEL) {
            seller = await prisma.hotelSeller.findUnique({
              where: { userId: user.id },
              select: { isApproved: true, isSuspended: true, onboardingCompleted: true, onboardingStep: true } as any
            })
          } else if (token.role === UserRole.SELLER_RESTAURANT) {
            seller = await prisma.restaurantSeller.findUnique({
              where: { userId: user.id },
              select: { isApproved: true, isSuspended: true, onboardingCompleted: true, onboardingStep: true } as any
            })
          } else {
            seller = await prisma.seller.findUnique({
              where: { userId: user.id },
              select: { isApproved: true, isSuspended: true, onboardingCompleted: true, onboardingStep: true } as any
            })
          }
          if (seller) {
            sellerInfo = { ...sellerInfo, ...seller }
          }
        }

        if (sellerInfo.isApproved !== undefined) token.isApproved = sellerInfo.isApproved
        if (sellerInfo.isSuspended !== undefined) token.isSuspended = sellerInfo.isSuspended
        if (sellerInfo.onboardingCompleted !== undefined)
          token.onboardingCompleted = sellerInfo.onboardingCompleted
        if (sellerInfo.onboardingStep !== undefined)
          token.onboardingStep = sellerInfo.onboardingStep
      } else if (token?.id) {
        // If not Edge runtime, verify password hash against database to invalidate outdated sessions
        if (process.env.NEXT_RUNTIME !== "edge") {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { password: true }
            })
            // Only check password hash for credential-based logins (not OAuth).
            // OAuth users have no password (null in DB), so token.passwordHash is also undefined.
            // We skip the check when neither the token nor the DB has a password hash.
            const tokenHasPassword = token.passwordHash != null
            const dbHasPassword = dbUser?.password != null
            if (
              !dbUser ||
              (tokenHasPassword && dbUser.password !== token.passwordHash) ||
              (dbHasPassword && dbUser.password !== token.passwordHash)
            ) {
              token.id = ""
              token.error = "SessionInvalidated"
              return token
            }
          } catch (error) {
            console.error("Error verifying password in jwt callback:", error)
          }
        }

        if (
          token.role === UserRole.SELLER_PRODUCT ||
          token.role === UserRole.SELLER_SERVICE ||
          token.role === UserRole.SELLER_HOTEL ||
          token.role === UserRole.SELLER_RESTAURANT
        ) {
          // Robustness: rely on the token's current state for the Edge runtime (middleware).
          // Real-time re-validation should happen in Node-safe layouts/pages, not in the JWT callback.
          if (token.onboardingCompleted === undefined) {
            token.onboardingCompleted = false
          }
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && (token.error === "SessionInvalidated" || !token.id)) {
        return null as any
      }
      if (session.user && token) {
        session.user.id = token.id as string
        if (token.email) session.user.email = token.email as string
        session.user.role = token.role as UserRole
        if (token.isApproved !== undefined)
          session.user.isApproved = token.isApproved as boolean
        if (token.isSuspended !== undefined)
          session.user.isSuspended = token.isSuspended as boolean
        if (token.onboardingCompleted !== undefined)
          session.user.onboardingCompleted = token.onboardingCompleted as boolean
        if (token.onboardingStep !== undefined)
          session.user.onboardingStep = token.onboardingStep as number
      }
      return session
    },
    redirect({ url, baseUrl }) {
      // Use callbackUrl from signIn("google", { callbackUrl: "/product-seller" }) so seller panels get the right redirect
      try {
        // Allow our OAuth post-process endpoint as a safe intermediate redirect.
        if (typeof url === "string" && url.startsWith("/api/auth/oauth-postprocess")) {
          return `${baseUrl.replace(/\/$/, "")}${url}`
        }

        const parsed = url.startsWith("/") ? new URL(url, baseUrl) : new URL(url)
        const callbackUrl = parsed.searchParams.get("callbackUrl") ?? parsed.searchParams.get("redirect")
        if (callbackUrl && typeof callbackUrl === "string" && isSafeRedirectUrl(callbackUrl, baseUrl)) {
          const allowed = ["/customer", "/product-seller", "/service-seller", "/admin", "/dashboard"]
          if (allowed.some((p) => callbackUrl === p || callbackUrl.startsWith(p + "/"))) {
            return `${baseUrl.replace(/\/$/, "")}${callbackUrl}`
          }
        }
      } catch {
        /* ignore */
      }
      if (typeof url === "string" && isSafeRedirectUrl(url, baseUrl)) {
        if (url.startsWith("/")) return `${baseUrl.replace(/\/$/, "")}${url}`
        return url
      }
      return baseUrl
    },
  },
})

