import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import Facebook from "next-auth/providers/facebook"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

const AUTH_INTENDED_ROLE_COOKIE = "auth_intended_role"

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
      // Link OAuth accounts to existing users by verified email so sellers can use Google
      allowDangerousEmailAccountLinking: true,
    })
  )
}
if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
  providers.push(
    Facebook({
      clientId: process.env.AUTH_FACEBOOK_ID,
      clientSecret: process.env.AUTH_FACEBOOK_SECRET,
      allowDangerousEmailAccountLinking: true,
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
  events: {
    // When a new user is created via OAuth (Google/Facebook) from seller login pages,
    // create Seller record and set role from auth_intended_role cookie.
    async createUser({ user }) {
      if (!user?.id) return
      const cookieStore = await cookies()
      const intended = cookieStore.get(AUTH_INTENDED_ROLE_COOKIE)?.value
      if (intended === UserRole.SELLER_PRODUCT) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: UserRole.SELLER_PRODUCT, isEmailVerified: true },
        })
        await prisma.seller.create({ data: { userId: user.id, type: "PRODUCT" } })
      } else if (intended === UserRole.SELLER_SERVICE) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: UserRole.SELLER_SERVICE, isEmailVerified: true },
        })
        await prisma.seller.create({ data: { userId: user.id, type: "SERVICE" } })
      }
    },
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        if ((user as any).isApproved !== undefined)
          token.isApproved = (user as any).isApproved
        if ((user as any).isSuspended !== undefined)
          token.isSuspended = (user as any).isSuspended
        // OAuth (Google/Facebook): resolve role from DB; if user has a Seller record, use that role so they get seller access when logging in from seller panels.
        // We also respect auth_intended_role cookie so that logging in from the customer panel forces CUSTOMER role even if the user has a seller record.
        if (account?.provider === "google" || account?.provider === "facebook") {
          const cookieStore = await cookies().catch(() => null)
          const intended = cookieStore?.get(AUTH_INTENDED_ROLE_COOKIE)?.value as UserRole | undefined
          if (intended === UserRole.CUSTOMER) {
            token.role = UserRole.CUSTOMER
            delete token.isApproved
            delete token.isSuspended
            return token
          }

          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, seller: { select: { type: true, isApproved: true, isSuspended: true } } },
          })
          if (dbUser?.seller) {
            token.role = dbUser.seller.type === "PRODUCT" ? UserRole.SELLER_PRODUCT : UserRole.SELLER_SERVICE
            token.isApproved = dbUser.seller.isApproved
            token.isSuspended = dbUser.seller.isSuspended ?? false
          } else if (dbUser) {
            token.role = dbUser.role
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
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

