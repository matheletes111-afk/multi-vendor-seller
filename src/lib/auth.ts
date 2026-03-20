import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import Facebook from "next-auth/providers/facebook"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers: any[] = [
  Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        const requestedRole = credentials.role as string | undefined
        if (requestedRole && user.role !== requestedRole) {
          return null
        }

        // Sellers: allow login even if pending admin approval, but block suspended.
        // We also surface isApproved / isSuspended on the session so middleware can restrict access.
        if (
          user.role === UserRole.SELLER_PRODUCT ||
          user.role === UserRole.SELLER_SERVICE
        ) {
          const seller = await prisma.seller.findUnique({
            where: { userId: user.id },
            select: { isApproved: true, isSuspended: true },
          })
          if (
            !seller ||
            (seller.isSuspended ?? false)
          ) {
            return null
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.image,
            isApproved: seller.isApproved,
            isSuspended: seller.isSuspended ?? false,
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // Keep email in sync with the current OAuth/Credentials sign-in.
        token.email = user.email
        token.role = (user as any).role
        if ((user as any).isApproved !== undefined) token.isApproved = (user as any).isApproved
        if ((user as any).isSuspended !== undefined) token.isSuspended = (user as any).isSuspended
      }

      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        if (token.email) session.user.email = token.email as string
        session.user.role = token.role as UserRole
        if (token.isApproved !== undefined)
          session.user.isApproved = token.isApproved as boolean
        if (token.isSuspended !== undefined)
          session.user.isSuspended = token.isSuspended as boolean
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
        if (callbackUrl && typeof callbackUrl === "string" && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
          const allowed = ["/customer", "/product-seller", "/service-seller", "/admin", "/dashboard"]
          if (allowed.some((p) => callbackUrl === p || callbackUrl.startsWith(p + "/"))) {
            return `${baseUrl.replace(/\/$/, "")}${callbackUrl}`
          }
        }
      } catch {
        /* ignore */
      }
      if (url.startsWith("/")) return `${baseUrl.replace(/\/$/, "")}${url}`
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url
      } catch {
        /* ignore */
      }
      return baseUrl
    },
  },
})

